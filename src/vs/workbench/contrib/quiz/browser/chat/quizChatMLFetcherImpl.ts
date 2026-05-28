/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's ChatMLFetcherImpl (extension/prompt/node/chatMLFetcher.ts)
//
// This is the central dispatcher for ALL Quiz LLM requests, mirroring
// Copilot's ChatMLFetcherImpl. It handles:
// - Authentication token injection (copilotToken fallback)
// - ownsAuthorization checks (BYOK endpoints skip CAPI token)
// - Dual-path routing (HTTP / CAPI / ILanguageModelsService)
// - WebSocket with automatic HTTP fallback
// - Streaming response processing
// - Structured error classification
// - Retry logic (network error, stateful marker)
// - Telemetry events

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IQuizFetcherService } from '../../common/endpoint/quizFetcher.js';
import { IQuizQAPIClientService } from '../../common/endpoint/quizQAPIClient.js';
import { IQuizNetworkService, IQuizNetworkRequestEndpoint, IQuizNetworkRequest, canRetryOnceNetworkError } from '../../common/endpoint/quizNetwork.js';
import { IQuizEndpoint, IQuizChatRequestTelemetryProperties, IQuizChatRequestOptions } from '../../common/endpoint/quizEndpoint.js';
import { IQuizAuthProvider } from '../../common/auth/quizAuthProvider.js';
import { IQuizChatMLFetcher, IQuizFetchMLOptions, IQuizMadeChatRequestEvent, IQuizOptionalChatRequestParams } from '../../common/chat/quizChatMLFetcher.js';
import { QuizFetchResponseKind, QuizChatFailKind, QuizChatLocation, IQuizChatCompletion, IQuizToolCall, QuizChatFetchResult, IQuizChatQuotaService, QuizChatFetchResponseType } from '../../common/chat/quizChatTypes.js';
import { QuizFinishedCallback, QuizFetchStreamRecorder, quizClassifyFetchError } from '../../common/chat/quizChatStreamProcessor.js';
import { IQuizChatWebSocketManager } from '../../common/chat/quizChatWebSocketManager.js';

// #region QuizChatMLFetcherImpl (aligned with Copilot's ChatMLFetcherImpl)

/**
 * The central dispatcher for all Quiz LLM chat requests.
 * Aligned with Copilot's ChatMLFetcherImpl (extension/prompt/node/chatMLFetcher.ts).
 *
 * This class is the single entry point through which all Quiz LLM requests pass,
 * exactly mirroring Copilot's architecture where ChatMLFetcherImpl.fetchMany()
 * is the "main gate" for every chat/agent/edit request.
 */
export class QuizChatMLFetcherImpl extends Disposable implements IQuizChatMLFetcher {

	declare readonly _serviceBrand: undefined;

	private static readonly _maxConsecutiveWebSocketFallbacks = 3;

	/**
	 * Tracks consecutive WebSocket failures where HTTP retry succeeded.
	 * After N such failures, WebSocket is disabled entirely.
	 * Aligned with Copilot's _consecutiveWebSocketRetryFallbacks.
	 */
	private _consecutiveWebSocketRetryFallbacks = 0;

	private readonly _onDidMakeChatMLRequest = this._register(new Emitter<IQuizMadeChatRequestEvent>());
	readonly onDidMakeChatMLRequest: Event<IQuizMadeChatRequestEvent> = this._onDidMakeChatMLRequest.event;

	constructor(
		@IQuizFetcherService private readonly _fetcherService: IQuizFetcherService,
		@IQuizQAPIClientService private readonly _qapiClientService: IQuizQAPIClientService,
		@IQuizNetworkService private readonly _networkService: IQuizNetworkService,
		@IQuizAuthProvider private readonly _authService: IQuizAuthProvider,
		@IQuizChatWebSocketManager private readonly _webSocketManager: IQuizChatWebSocketManager,
		@IQuizChatQuotaService private readonly _quotaService: IQuizChatQuotaService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	/**
	 * Fetch a single chat completion.
	 * Aligned with Copilot's AbstractChatMLFetcher.fetchOne().
	 */
	async fetchOne(options: IQuizFetchMLOptions, token: CancellationToken): Promise<QuizChatFetchResult> {
		const result = await this.fetchMany({
			...options,
			requestOptions: { ...options.requestOptions, n: 1 },
		}, token);

		if (result.type === QuizFetchResponseKind.Success) {
			const completions: IQuizChatCompletion[] = [];
			for await (const c of result.chatCompletions) {
				completions.push(c);
			}
			const first = completions[0];
			if (!first) {
				return {
					type: QuizFetchResponseKind.Failed,
					modelRequestId: undefined,
					failKind: QuizChatFailKind.ServerError,
					reason: 'Response contained no choices.',
				};
			}
			return {
				type: QuizFetchResponseKind.Success,
				chatCompletions: (async function* () { yield first; })(),
			};
		}
		return result;
	}

	/**
	 * Fetch multiple chat completions.
	 * Aligned with Copilot's ChatMLFetcherImpl.fetchMany().
	 *
	 * This is the main entry point for all LLM requests.
	 */
	async fetchMany(options: IQuizFetchMLOptions, token: CancellationToken): Promise<QuizChatFetchResult> {
		let { debugName, endpoint, location, requestOptions, telemetryProperties, userInitiatedRequest, interactionTypeOverride, conversationId, turnId, useWebSocket, ignoreStatefulMarker } = options;

		// Disable WebSocket if too many consecutive fallbacks
		if (useWebSocket && this._consecutiveWebSocketRetryFallbacks >= QuizChatMLFetcherImpl._maxConsecutiveWebSocketFallbacks) {
			this._logService.debug(`[QuizChatMLFetcher] Disabling WebSocket due to ${this._consecutiveWebSocketRetryFallbacks} consecutive failures`);
			useWebSocket = false;
			ignoreStatefulMarker = true;
		}

		if (!telemetryProperties) {
			telemetryProperties = {};
		}
		if (!telemetryProperties.messageSource) {
			telemetryProperties.messageSource = debugName;
		}

		const ourRequestId = telemetryProperties.requestId ?? telemetryProperties.messageId ?? _generateRequestId();

		// Emit telemetry event for request start
		this._telemetryService.publicLog('quiz.chat.request.start', {
			model: endpoint.modelId,
			requestId: ourRequestId,
			source: debugName,
			...telemetryProperties,
		});

		// Quota service is available for header processing after response
		void this._quotaService;

		const maxResponseTokens = endpoint.maxOutputTokens;
		if (!requestOptions?.prediction) {
			requestOptions = { max_tokens: maxResponseTokens, ...requestOptions };
		}
		if (!requestOptions.prediction?.content) {
			delete requestOptions['prediction'];
		}

		const postOptions = this._preparePostOptions(requestOptions);
		const streamRecorder = new QuizFetchStreamRecorder();
		const canRetryOnce = options.canRetryOnceWithoutRollback ?? !(options.enableRetryOnFilter || options.enableRetryOnError);

		try {
			// Step 1: Get authentication token
			let secretKey = requestOptions.secretKey;
			let copilotToken: string | undefined;

			try {
				const isAuthenticated = await this._authService.isAuthenticated();
				if (isAuthenticated) {
					copilotToken = await this._authService.getAuthToken();
				}
			} catch {
				// BYOK / air-gapped: no token available
			}

			// Step 2: Inject copilotToken as fallback secretKey
			// Aligned with Copilot's ownsAuthorization logic
			if (!endpoint.ownsAuthorization) {
				secretKey ??= copilotToken;
			}
			if (!secretKey && !endpoint.ownsAuthorization) {
				this._logService.error(`[QuizChatMLFetcher] Missing key for ${endpoint.modelId}`);
				return {
					type: QuizFetchResponseKind.Failed,
					modelRequestId: undefined,
					failKind: QuizChatFailKind.TokenExpiredOrInvalid,
					reason: 'key is missing',
				};
			}

			// Step 3: Route the request (QAPI client available for CAPI path via IQuizNetworkService)
			this._logService.debug(`[QuizChatMLFetcher] Routing via ${this._qapiClientService ? 'QAPI' : 'HTTP'} for ${endpoint.modelId}`);
			const fetchResult = await this._fetchAndStreamChat(
				endpoint,
				postOptions,
				streamRecorder.createCallback(),
				secretKey,
				location,
				ourRequestId,
				postOptions.n,
				token,
				userInitiatedRequest,
				useWebSocket,
				turnId,
				conversationId,
				telemetryProperties,
				canRetryOnce,
				interactionTypeOverride,
				ignoreStatefulMarker,
				options.summarizedAtRoundId,
				options.modeChanged,
			);

			// Step 4: Emit telemetry event
			this._onDidMakeChatMLRequest.fire({
				model: endpoint.modelId,
				source: options.source,
			});

			return fetchResult;
		} catch (err) {
			if (err instanceof CancellationError || this._fetcherService.isAbortError(err)) {
				return {
					type: QuizFetchResponseKind.Canceled,
					reason: 'request cancelled',
				};
			}

			this._logService.error(`[QuizChatMLFetcher] fetchMany failed: ${err}`);
			return {
				type: QuizFetchResponseKind.Failed,
				modelRequestId: undefined,
				failKind: QuizChatFailKind.Unknown,
				reason: err instanceof Error ? err.message : String(err),
			};
		}
	}

	// #endregion

	// #region Internal: _preparePostOptions (aligned with Copilot's AbstractChatMLFetcher)

	private _preparePostOptions(requestOptions: IQuizOptionalChatRequestParams): IQuizOptionalChatRequestParams {
		return {
			stream: true,
			...requestOptions,
		};
	}

	// #endregion

	// #region Internal: _fetchAndStreamChat (aligned with Copilot's _fetchAndStreamChat)

	private async _fetchAndStreamChat(
		chatEndpoint: IQuizEndpoint,
		postOptions: IQuizOptionalChatRequestParams,
		finishedCb: QuizFinishedCallback,
		secretKey: string | undefined,
		location: QuizChatLocation,
		ourRequestId: string,
		nChoices: number | undefined,
		cancellationToken: CancellationToken,
		userInitiatedRequest?: boolean,
		useWebSocket?: boolean,
		turnId?: string,
		conversationId?: string,
		telemetryProperties?: IQuizChatRequestTelemetryProperties,
		canRetryOnce?: boolean,
		interactionTypeOverride?: string,
		ignoreStatefulMarker?: boolean,
		summarizedAtRoundId?: string,
		modeChanged?: boolean,
	): Promise<QuizChatFetchResult> {
		if (cancellationToken.isCancellationRequested) {
			return { type: QuizFetchResponseKind.Canceled, reason: 'before fetch request' };
		}

		// WebSocket path: use persistent connection for Responses API endpoints
		if (useWebSocket && turnId && conversationId) {
			try {
				const wsResult = await this._doFetchViaWebSocket(
					chatEndpoint,
					postOptions,
					finishedCb,
					secretKey,
					location,
					ourRequestId,
					turnId,
					conversationId,
					cancellationToken,
					userInitiatedRequest,
					telemetryProperties,
					interactionTypeOverride,
					summarizedAtRoundId,
					modeChanged,
				);
				return wsResult;
			} catch (wsError) {
				// WebSocket failed — fall back to HTTP
				this._logService.warn(`[QuizChatMLFetcher] WebSocket failed, falling back to HTTP: ${wsError}`);
				this._consecutiveWebSocketRetryFallbacks++;
			}
		}

		// HTTP path (default)
		return this._doFetchViaHttp(
			chatEndpoint,
			postOptions,
			finishedCb,
			secretKey,
			location,
			ourRequestId,
			nChoices,
			cancellationToken,
			userInitiatedRequest,
			telemetryProperties,
			canRetryOnce,
			interactionTypeOverride,
		);
	}

	// #endregion

	// #region Internal: _doFetchViaHttp (aligned with Copilot's _doFetchViaHttp)

	private async _doFetchViaHttp(
		chatEndpoint: IQuizEndpoint,
		postOptions: IQuizOptionalChatRequestParams,
		finishedCb: QuizFinishedCallback,
		secretKey: string | undefined,
		location: QuizChatLocation,
		ourRequestId: string,
		nChoices: number | undefined,
		cancellationToken: CancellationToken,
		userInitiatedRequest?: boolean,
		telemetryProperties?: IQuizChatRequestTelemetryProperties,
		canRetryOnce?: boolean,
		interactionTypeOverride?: string,
	): Promise<QuizChatFetchResult> {
		// Build request body
		const chatRequestOptions: IQuizChatRequestOptions = { debugName: 'quiz-chatml', maxOutputTokens: postOptions.max_tokens, temperature: postOptions.temperature, prediction: postOptions.prediction ? { type: 'content', content: postOptions.prediction.content } : undefined };
		const requestBody = chatEndpoint.createRequestBody?.([], chatRequestOptions) ?? { stream: true, ...postOptions };

		// Build endpoint for network routing
		const networkEndpoint: IQuizNetworkRequestEndpoint = {
			urlOrRequestMetadata: chatEndpoint.urlOrRequestMetadata ?? '',
			headers: chatEndpoint.getExtraHeaders?.(QuizChatLocation.toString(location), interactionTypeOverride) ?? {},
			getExtraHeaders: chatEndpoint.getExtraHeaders,
			interceptBody: chatEndpoint.interceptBody as ((body: Record<string, unknown>) => void) | undefined,
			getEndpointFetchOptions: chatEndpoint.getEndpointFetchOptions,
		};

		const request: IQuizNetworkRequest = {
			body: requestBody,
			method: 'POST',
			token: cancellationToken,
			callSite: `quiz-chatml-${chatEndpoint.modelId}`,
			stream: true,
			headers: {
				'X-Request-Id': ourRequestId,
				'X-Initiator': userInitiatedRequest ? 'user' : 'agent',
			},
		};

		let retryCount = 0;
		const maxRetries = 1; // Aligned with Copilot's single retry on network error

		try {
			// Use networkRequestStream for SSE streaming (aligned with Copilot's streaming path)
			const completions: IQuizChatCompletion[] = [];
			let currentText = '';
			let currentFinishReason = 'stop';
			let currentUsage: IQuizChatCompletion['usage'] | undefined;
			let currentResolvedModel: string | undefined;
			const toolCallArgs = new Map<number, string>();
			const toolCallNames = new Map<number, string>();
			const toolCallIds = new Map<number, string>();

			const attemptStream = async (): Promise<QuizChatFetchResult> => {
				for await (const chunk of this._networkService.networkRequestStream(networkEndpoint, request)) {
					// Check for error status
					if (chunk.errorStatus !== undefined && chunk.errorStatus >= 400) {
						const errorBody = chunk.data as Record<string, unknown> | null;
						const responseType = quizClassifyFetchError(chunk.errorStatus, errorBody, ourRequestId, undefined);

						// Retry on network error or invalid stateful marker
						if (retryCount < maxRetries && (responseType === QuizChatFetchResponseType.NetworkError || responseType === QuizChatFetchResponseType.InvalidStatefulMarker)) {
							retryCount++;
							this._logService.debug(`[QuizChatMLFetcher] Retrying after ${responseType} (attempt ${retryCount})`);
							// Remove previous_response_id on retry for invalid stateful marker
							if (responseType === QuizChatFetchResponseType.InvalidStatefulMarker && typeof request.body === 'object' && request.body !== null) {
								delete (request.body as Record<string, unknown>)['previous_response_id'];
							}
							return attemptStream();
						}

						const failKind = this._classifyFetchResponseType(responseType);
						return {
							type: QuizFetchResponseKind.Failed,
							modelRequestId: ourRequestId,
							failKind,
							reason: `HTTP ${chunk.errorStatus}: ${errorBody?.error ? JSON.stringify(errorBody.error) : 'Unknown error'}`,
						};
					}

					const data = chunk.data as Record<string, unknown> | null;
					if (!data) { continue; }

					// OpenAI Chat Completions API format (delta-based)
					if (Array.isArray(data.choices)) {
						for (const choice of data.choices as Array<Record<string, unknown>>) {
							const delta = choice.delta as Record<string, unknown> | undefined;
							if (delta) {
								if (delta.content) {
									currentText += String(delta.content);
								}
								if (delta.tool_calls) {
									for (const tc of (delta.tool_calls as Array<Record<string, unknown>>)) {
										const tcIndex = (tc.index as number) ?? 0;
										if (tc.id) { toolCallIds.set(tcIndex, String(tc.id)); }
										if ((tc.function as Record<string, unknown> | undefined)?.name) { toolCallNames.set(tcIndex, String((tc.function as Record<string, unknown>)!.name)); }
										if ((tc.function as Record<string, unknown> | undefined)?.arguments) { toolCallArgs.set(tcIndex, (toolCallArgs.get(tcIndex) ?? '') + String((tc.function as Record<string, unknown>)!.arguments)); }
									}
								}
							}
							if (choice.finish_reason) {
								currentFinishReason = String(choice.finish_reason);
							}
						}
						if (data.usage) {
							currentUsage = data.usage as IQuizChatCompletion['usage'];
						}
						if (data.model) {
							currentResolvedModel = String(data.model);
						}
					}

					// OpenAI Responses API format (event-based)
					if (data.type) {
						const eventType = data.type as string;
						if (eventType === 'response.output_text.delta' || eventType === 'response.text.delta') {
							currentText += (data.delta as string) ?? '';
						} else if (eventType === 'response.function_call_arguments.delta') {
							const args = (data.delta as string) ?? '';
							toolCallArgs.set(0, (toolCallArgs.get(0) ?? '') + args);
						} else if (eventType === 'response.completed' || eventType === 'response.done') {
							const response = data.response as Record<string, unknown> | undefined;
							if (response?.usage) {
								currentUsage = response.usage as IQuizChatCompletion['usage'];
							}
							if (response?.model) {
								currentResolvedModel = String(response.model);
							}
							currentFinishReason = 'stop';
						}
					}

					// Fire finishedCb for each chunk with text content
					if (currentText) {
						const delta = { text: currentText };
						await finishedCb(currentText, 0, delta);
					}

					// On final chunk, build and yield the completion
					if (chunk.isFinal) {
						// Build tool calls from accumulated data
						const toolCalls: IQuizChatCompletion['toolCalls'] = toolCallArgs.size > 0 ? [] : undefined;
						if (toolCallArgs.size > 0) {
							for (const [idx, args] of toolCallArgs) {
								(toolCalls as IQuizToolCall[]).push({
									id: toolCallIds.get(idx) ?? '',
									name: toolCallNames.get(idx) ?? '',
									arguments: args,
								});
							}
						}

						const completion: IQuizChatCompletion = {
							text: currentText,
							finishReason: currentFinishReason,
							usage: currentUsage,
							resolvedModel: currentResolvedModel,
							toolCalls,
						};
						completions.push(completion);

						// Process quota headers
						this._quotaService.processQuotaHeaders(new Headers());

						return {
							type: QuizFetchResponseKind.Success,
							chatCompletions: (async function* () { yield completion; })(),
						};
					}
				}

				// Stream ended without final chunk — still return what we have
				if (currentText || toolCallArgs.size > 0) {
					const toolCalls: IQuizChatCompletion['toolCalls'] = toolCallArgs.size > 0 ? [] : undefined;
					if (toolCallArgs.size > 0) {
						for (const [idx, args] of toolCallArgs) {
							(toolCalls as IQuizToolCall[]).push({
								id: toolCallIds.get(idx) ?? '',
								name: toolCallNames.get(idx) ?? '',
								arguments: args,
							});
						}
					}
					const completion: IQuizChatCompletion = {
						text: currentText,
						finishReason: currentFinishReason,
						usage: currentUsage,
						resolvedModel: currentResolvedModel,
						toolCalls,
					};
					return {
						type: QuizFetchResponseKind.Success,
						chatCompletions: (async function* () { yield completion; })(),
					};
				}

				return {
					type: QuizFetchResponseKind.Failed,
					modelRequestId: ourRequestId,
					failKind: QuizChatFailKind.ServerError,
					reason: 'Stream ended without data',
				};
			};

			return await attemptStream();
		} catch (err) {
			if (err instanceof CancellationError || this._fetcherService.isAbortError(err)) {
				return { type: QuizFetchResponseKind.Canceled, reason: 'request cancelled' };
			}

			// Retry on network error (aligned with Copilot's canRetryOnceNetworkError)
			if (canRetryOnce && canRetryOnceNetworkError(err) && retryCount < maxRetries) {
				this._logService.debug(`[QuizChatMLFetcher] Retrying after network error`);
				retryCount++;
				await this._fetcherService.disconnectAll();
				// Recursive call with retry disabled
				return this._doFetchViaHttp(
					chatEndpoint, postOptions, finishedCb, secretKey, location, ourRequestId, nChoices, cancellationToken,
					userInitiatedRequest, telemetryProperties, false, interactionTypeOverride,
				);
			}

			const failKind = this._classifyError(err);
			return {
				type: QuizFetchResponseKind.Failed,
				modelRequestId: ourRequestId,
				failKind,
				reason: err instanceof Error ? err.message : String(err),
			};
		}
	}

	// #endregion

	// #region Internal: _doFetchViaWebSocket (aligned with Copilot's _doFetchViaWebSocket)

	private async _doFetchViaWebSocket(
		chatEndpoint: IQuizEndpoint,
		postOptions: IQuizOptionalChatRequestParams,
		finishedCb: QuizFinishedCallback,
		secretKey: string | undefined,
		location: QuizChatLocation,
		ourRequestId: string,
		turnId: string,
		conversationId: string,
		cancellationToken: CancellationToken,
		userInitiatedRequest?: boolean,
		telemetryProperties?: IQuizChatRequestTelemetryProperties,
		interactionTypeOverride?: string,
		summarizedAtRoundId?: string,
		modeChanged?: boolean,
	): Promise<QuizChatFetchResult> {
		// Get or create a WebSocket connection for this conversation
		const headers: Record<string, string> = {
			'Authorization': secretKey ? `Bearer ${secretKey}` : '',
			'X-Request-Id': ourRequestId,
			'OpenAI-Intent': _locationToIntent(location),
			...(chatEndpoint.getExtraHeaders?.(QuizChatLocation.toString(location), interactionTypeOverride) ?? {}),
		};

		const connection = this._webSocketManager.getOrCreateConnection(conversationId, headers, ourRequestId);

		try {
			if (!connection.isOpen) {
				await connection.connect();
			}
		} catch (connectError) {
			this._logService.warn(`[QuizChatMLFetcher] WebSocket connect failed: ${connectError}`);
			throw connectError; // Will trigger HTTP fallback
		}

		// Build request body — createRequestBody takes messages and IQuizChatRequestOptions
		const wsChatRequestOptions: IQuizChatRequestOptions = { debugName: 'quiz-chatml-ws', maxOutputTokens: postOptions.max_tokens, temperature: postOptions.temperature, prediction: postOptions.prediction ? { type: 'content', content: postOptions.prediction.content } : undefined };
		const wsRequestBody: Record<string, unknown> = { ...(chatEndpoint.createRequestBody?.([], wsChatRequestOptions) ?? { stream: true, ...postOptions }) };

		// Send request via WebSocket
		const requestHandle = connection.sendRequest(wsRequestBody, {
			userInitiated: userInitiatedRequest ?? false,
			turnId,
			requestId: ourRequestId,
			model: chatEndpoint.modelId,
			countTokens: () => Promise.resolve(0),
			tokenCountMax: chatEndpoint.modelMaxPromptTokens,
			modelMaxPromptTokens: chatEndpoint.modelMaxPromptTokens,
			summarizedAtRoundId,
			modeChanged,
		}, cancellationToken);

		// Process WebSocket stream events into chat completions
		const completions: IQuizChatCompletion[] = [];
		let currentText = '';
		let finishReason = 'stop';

		return new Promise<QuizChatFetchResult>((resolve) => {
			requestHandle.onEvent((event) => {
				const data = event as Record<string, unknown>;
				const eventType = data.type as string;

				if (eventType === 'response.output_text.delta' || eventType === 'response.text.delta') {
					currentText += (data.delta as string) ?? '';
				} else if (eventType === 'response.completed' || eventType === 'response.done') {
					finishReason = 'stop';
				} else if (eventType === 'response.function_call_arguments.delta') {
					// Tool call arguments delta
				}
			});

			requestHandle.onError((error) => {
				this._logService.error(`[QuizChatMLFetcher] WebSocket stream error: ${error}`);
				resolve({
					type: QuizFetchResponseKind.Failed,
					modelRequestId: ourRequestId,
					failKind: QuizChatFailKind.NetworkError,
					reason: error.message,
				});
			});

			requestHandle.done.then(() => {
				// Reset consecutive fallback counter on success
				this._consecutiveWebSocketRetryFallbacks = 0;

				const completion: IQuizChatCompletion = {
					text: currentText,
					finishReason,
				};
				completions.push(completion);

				resolve({
					type: QuizFetchResponseKind.Success,
					chatCompletions: (async function* () { yield completion; })(),
				});
			}).catch((error: Error) => {
				resolve({
					type: QuizFetchResponseKind.Failed,
					modelRequestId: ourRequestId,
					failKind: this._classifyError(error),
					reason: error.message,
				});
			});
		});
	}

	// #endregion

	// #region Internal: _classifyError (aligned with Copilot's error classification)

	private _classifyError(err: unknown): QuizChatFailKind {
		if (!(err instanceof Error)) {
			return QuizChatFailKind.Unknown;
		}
		const msg = err.message.toLowerCase();

		if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('etimedout')) {
			return QuizChatFailKind.NetworkError;
		}
		if (msg.includes('rate limit') || msg.includes('429')) {
			return QuizChatFailKind.RateLimited;
		}
		if (msg.includes('quota') || msg.includes('exceeded')) {
			return QuizChatFailKind.QuotaExceeded;
		}
		if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('token')) {
			return QuizChatFailKind.TokenExpiredOrInvalid;
		}
		if (msg.includes('content filter') || msg.includes('filtered')) {
			return QuizChatFailKind.ContentFilter;
		}
		if (msg.includes('not found') || msg.includes('404')) {
			return QuizChatFailKind.NotFound;
		}

		return QuizChatFailKind.Unknown;
	}

	/**
	 * Convert a QuizChatFetchResponseType to a QuizChatFailKind.
	 * Aligned with Copilot's error classification mapping.
	 */
	private _classifyFetchResponseType(responseType: QuizChatFetchResponseType): QuizChatFailKind {
		switch (responseType) {
			case QuizChatFetchResponseType.OffTopic: return QuizChatFailKind.OffTopic;
			case QuizChatFetchResponseType.Filtered:
			case QuizChatFetchResponseType.PromptFiltered:
				return QuizChatFailKind.ContentFilter;
			case QuizChatFetchResponseType.RateLimited: return QuizChatFailKind.RateLimited;
			case QuizChatFetchResponseType.QuotaExceeded: return QuizChatFailKind.QuotaExceeded;
			case QuizChatFetchResponseType.NotFound: return QuizChatFailKind.NotFound;
			case QuizChatFetchResponseType.NetworkError: return QuizChatFailKind.NetworkError;
			case QuizChatFetchResponseType.InvalidStatefulMarker: return QuizChatFailKind.InvalidPreviousResponseId;
			case QuizChatFetchResponseType.AgentUnauthorized: return QuizChatFailKind.AgentUnauthorized;
			case QuizChatFetchResponseType.AgentFailedDependency: return QuizChatFailKind.AgentFailedDependency;
			case QuizChatFetchResponseType.BadRequest: return QuizChatFailKind.ValidationFailed;
			default: return QuizChatFailKind.Unknown;
		}
	}

	// #endregion
}

// #endregion

// #region Helper: _locationToIntent (aligned with Copilot's locationToIntent)

function _locationToIntent(location: QuizChatLocation): string {
	switch (location) {
		case QuizChatLocation.Panel: return 'conversationPanel';
		case QuizChatLocation.Editor:
		case QuizChatLocation.Notebook:
		case QuizChatLocation.Terminal: return 'conversationInline';
		case QuizChatLocation.EditingSession: return 'editingSession';
		case QuizChatLocation.Agent: return 'editingSessionAgent';
		default: return 'chat';
	}
}

// #endregion

// #region Helper: _generateRequestId

function _generateRequestId(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

// #endregion
