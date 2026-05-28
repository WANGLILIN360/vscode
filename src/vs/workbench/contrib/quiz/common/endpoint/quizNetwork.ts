/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import type { IQuizFetcherService, IQuizFetchOptions, IQuizAbortSignal } from './quizFetcher.js';
import type { IQuizQAPIClientService, QuizRequestMetadata, IQuizMakeRequestOptions } from './quizQAPIClient.js';

// #region IQuizNetworkRequestEndpoint (aligned with Copilot's endpoint routing)

/**
 * Endpoint descriptor that determines the network routing path.
 * Aligned with Copilot's endpoint.urlOrRequestMetadata pattern.
 *
 * This is the key discriminating type in Copilot's dual-path architecture:
 * - If `urlOrRequestMetadata` is a **string** → HTTP path via IQuizFetcherService
 * - If `urlOrRequestMetadata` is **QuizRequestMetadata** → CAPI path via IQuizQAPIClientService
 *
 * Example endpoint configurations:
 * - CopilotChatEndpoint: { urlOrRequestMetadata: { type: QuizRequestType.ChatResponses } }
 * - OpenAIEndpoint (BYOK): { urlOrRequestMetadata: 'https://api.openai.com/v1/chat/completions' }
 * - ProxyAgenticEndpoint: { urlOrRequestMetadata: { type: QuizRequestType.ChatCompletions } }
 * - XtabEndpoint: { urlOrRequestMetadata: 'https://copilot-proxy.xtab.github.net/...' }
 */
export interface IQuizNetworkRequestEndpoint {
	/** The endpoint URL (string) or CAPI request metadata (object) */
	readonly urlOrRequestMetadata: string | QuizRequestMetadata;
	/** Additional headers to include in the request */
	readonly headers?: { readonly [name: string]: string };
	/** Whether this endpoint supports WebSocket connections */
	readonly supportsWebSocket?: boolean;
	/** The API endpoint type (e.g., /chat/completions, /responses, /v1/messages) */
	readonly supportedEndpoint?: string;
	/** Whether this endpoint owns its own authorization (BYOK) */
	readonly ownsAuthorization?: boolean;
	/** Get extra HTTP headers for this endpoint (e.g., Anthropic beta, BYOK auth) */
	getExtraHeaders?(location?: string, interactionTypeOverride?: string): Record<string, string>;
	/** Intercept and modify the request body before sending */
	interceptBody?(body: Record<string, unknown>): void;
	/** Get endpoint-specific fetch options (e.g., suppressIntegrationId) */
	getEndpointFetchOptions?(): { readonly suppressIntegrationId?: boolean };
}

// #endregion

// #region IQuizNetworkRequest (aligned with Copilot's networkRequest input)

/**
 * A network request to be routed through the dual-path architecture.
 * Aligned with Copilot's networkRequest() parameters.
 */
export interface IQuizNetworkRequest {
	/** The request body (JSON-serializable) */
	readonly body?: unknown;
	/** HTTP headers */
	readonly headers?: { readonly [name: string]: string };
	/** HTTP method */
	readonly method?: 'GET' | 'POST' | 'PUT';
	/** Request timeout in ms */
	readonly timeout?: number;
	/** Cancellation token */
	readonly token?: CancellationToken;
	/** Call site for telemetry */
	readonly callSite?: string;
	/** Whether to stream the response */
	readonly stream?: boolean;
}

// #endregion

// #region IQuizNetworkResponse (aligned with Copilot's network response)

/**
 * A network response from either the HTTP or CAPI path.
 * Provides unified access to status, headers, and body regardless of routing path.
 */
export interface IQuizNetworkResponse {
	/** HTTP status code */
	readonly status: number;
	/** Response headers */
	readonly headers: { readonly [name: string]: string };
	/** Parsed response body */
	readonly body: unknown;
	/** The request ID from the response header */
	readonly headerRequestId?: string;
	/** The GitHub request ID from the response header */
	readonly gitHubRequestId?: string;
}

// #endregion

// #region IQuizNetworkService (aligned with Copilot's networkRequest routing)

export const IQuizNetworkService = createDecorator<IQuizNetworkService>('quizNetworkService');

/**
 * Unified network request service that routes between the two API paths.
 * Aligned with Copilot's networkRequest() function (from platform/networking/common/networking.ts).
 *
 * This is the **central routing hub** for all Quiz API calls, mirroring
 * Copilot's dual-path architecture:
 *
 * ```
 * IQuizNetworkService.networkRequest(endpoint, request)
 *   │
 *   ├── typeof endpoint.urlOrRequestMetadata === 'string'
 *   │     → IQuizFetcherService.fetch(url, request)        ← HTTP path
 *   │         (BYOK, xtab, WebSocket, etc.)
 *   │
 *   └── else (QuizRequestMetadata)
 *         → IQuizQAPIClientService.makeRequest(request, metadata)  ← CAPI path
 *             (Copilot official models, telemetry, ignore, etc.)
 * ```
 *
 * ### Why this matters for Quiz (profit-critical):
 *
 * Copilot's revenue flows through this routing:
 * 1. **CAPI path** → Authenticated, metered, AIC-billed requests
 * 2. **HTTP path** → Unmetered (BYOK) or separately billed requests
 *
 * Quiz must mirror this exactly to ensure:
 * - Correct authentication and billing for every request
 * - Proper error classification and retry logic per path
 * - Telemetry that matches Copilot's request attribution
 * - Future compatibility with Copilot's API evolution
 */
export interface IQuizNetworkService {
	readonly _serviceBrand: undefined;

	/**
	 * Send a network request, automatically routing to the correct path.
	 * Aligned with Copilot's networkRequest() function.
	 *
	 * This is the single entry point for all API calls in Quiz,
	 * equivalent to Copilot's ChatMLFetcherImpl → networkRequest() path.
	 *
	 * @param endpoint The endpoint descriptor (determines routing path)
	 * @param request The request to send
	 * @returns The network response
	 * @throws IQuizEndpointError on failure
	 */
	networkRequest(endpoint: IQuizNetworkRequestEndpoint, request: IQuizNetworkRequest): Promise<IQuizNetworkResponse>;

	/**
	 * Send a streaming network request.
	 * Returns an async iterable of response chunks.
	 * Used for chat/completion streaming responses.
	 *
	 * @param endpoint The endpoint descriptor (determines routing path)
	 * @param request The request to send
	 * @returns An async iterable of streaming response chunks
	 */
	networkRequestStream(endpoint: IQuizNetworkRequestEndpoint, request: IQuizNetworkRequest): AsyncIterable<IQuizNetworkStreamChunk>;

	/**
	 * Create a WebSocket connection for streaming.
	 * Only available for endpoints that support WebSocket.
	 *
	 * @param endpoint The endpoint descriptor
	 * @param request The initial request (for auth headers)
	 */
	createWebSocketConnection(endpoint: IQuizNetworkRequestEndpoint, request: IQuizNetworkRequest): Promise<IQuizWebSocketStreamConnection>;
}

// #endregion

// #region IQuizNetworkStreamChunk (aligned with Copilot's streaming response chunks)

/**
 * A chunk of streaming response data.
 * Aligned with Copilot's SSE/streaming response parsing.
 */
export interface IQuizNetworkStreamChunk {
	/** The chunk data (parsed JSON or raw text) */
	readonly data: unknown;
	/** Whether this is the final chunk */
	readonly isFinal: boolean;
	/** SSE event type (if applicable) */
	readonly eventType?: string;
	/** Finish reason (in final chunk) */
	readonly finishReason?: string;
	/** Token usage (in final chunk) */
	readonly usage?: { promptTokens: number; completionTokens: number; totalTokens?: number };
	/** HTTP error status code (when status >= 400) */
	readonly errorStatus?: number;
}

// #endregion

// #region IQuizWebSocketStreamConnection (aligned with Copilot's WebSocket streaming)

/**
 * A WebSocket-based streaming connection.
 * Used for the Responses API over WebSocket.
 */
export interface IQuizWebSocketStreamConnection {
	/** Send data through the WebSocket */
	send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
	/** Close the connection */
	close(code?: number, reason?: string): void;
	/** Async iterable of response chunks */
	stream: AsyncIterable<IQuizNetworkStreamChunk>;
}

// #endregion

// #region quizNetworkRequest routing function (aligned with Copilot's networkRequest)

/**
 * Default request timeout in ms.
 * Aligned with Copilot's requestTimeoutMs.
 */
export const QUIZ_REQUEST_TIMEOUT_MS = 60000;

/**
 * Check if a network error is retryable (connection reset, etc.).
 * Aligned with Copilot's canRetryOnceNetworkError().
 */
export function canRetryOnceNetworkError(reason: unknown): boolean {
	if (!(reason instanceof Error)) {
		return false;
	}
	const msg = reason.message.toLowerCase();
	return msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('socket hang up') || msg.includes('network');
}

/**
 * Options for the network request routing function.
 * Aligned with Copilot's INetworkRequestOptions.
 */
export interface IQuizNetworkRequestOptions {
	/** Whether to retry once on network error (default: true) */
	readonly canRetryOnce?: boolean;
	/** Intent string for CAPI routing (e.g., 'chat', 'copilot-chat') */
	readonly intent?: string;
	/** Override for X-Interaction-Type header (e.g., 'conversation-subagent') */
	readonly interactionTypeOverride?: string;
	/** BYOK secret key for Authorization header */
	readonly secretKey?: string;
	/** Chat location context (e.g., 'panel', 'editor') for getExtraHeaders */
	readonly location?: string;
}

/**
 * Pure function that implements the dual-path routing logic with retry and abort.
 * Aligned with Copilot's networkRequest() from networking.ts.
 *
 * Routing logic (exactly mirroring Copilot):
 * ```
 * if (typeof endpoint.urlOrRequestMetadata === 'string') {
 *   // Path A: HTTP via IFetcherService
 *   return fetcher.fetch(url, request);
 * } else {
 *   // Path B: CAPI SDK via ICAPIClientService
 *   return qapiClient.makeRequest(request, endpoint.urlOrRequestMetadata);
 * }
 * ```
 *
 * Additional features aligned with Copilot:
 * - Retry once on connection reset (with disconnectAll before retry)
 * - Abort controller integration for cancellation
 * - Standard Copilot headers (X-Request-Id, OpenAI-Intent, X-GitHub-Api-Version, etc.)
 */
export async function quizNetworkRequest(
	fetcher: IQuizFetcherService,
	qapiClient: IQuizQAPIClientService,
	endpoint: IQuizNetworkRequestEndpoint,
	request: IQuizNetworkRequest,
	networkOptions?: IQuizNetworkRequestOptions,
): Promise<IQuizNetworkResponse> {
	const canRetryOnce = networkOptions?.canRetryOnce ?? true;
	const requestId = request.headers?.['X-Request-Id'] ?? generateRequestId();

	// Determine intent from endpoint metadata or request options
	const intent = networkOptions?.intent ?? (typeof endpoint.urlOrRequestMetadata !== 'string' ? endpoint.urlOrRequestMetadata.type : 'chat');

	// Build standard Copilot headers (aligned with Copilot's networkRequest())
	const standardHeaders: Record<string, string> = {
		'X-Request-Id': requestId,
		'X-GitHub-Api-Version': '2026-01-09',
		'OpenAI-Intent': intent,
		'X-Interaction-Type': networkOptions?.interactionTypeOverride ?? intent,
		'X-Agent-Task-Id': requestId,
		...request.headers,
	};

	// Inject BYOK secret key (aligned with Copilot's secretKey handling)
	if (networkOptions?.secretKey) {
		standardHeaders['Authorization'] = `Bearer ${networkOptions.secretKey}`;
	}

	// Merge endpoint-specific extra headers (aligned with Copilot's endpoint.getExtraHeaders())
	if (endpoint.getExtraHeaders) {
		Object.assign(standardHeaders, endpoint.getExtraHeaders(networkOptions?.location, networkOptions?.interactionTypeOverride));
	}

	// Intercept body before sending (aligned with Copilot's endpoint.interceptBody())
	const originalBody = request.body;
	let body: typeof originalBody;
	if (originalBody !== null && typeof originalBody === 'object') {
		// Shallow-clone so interceptBody can mutate without affecting the original
		const bodyObj: Record<string, unknown> = {};
		for (const key of Object.keys(originalBody)) {
			bodyObj[key] = (originalBody as Record<string, unknown>)[key];
		}
		body = bodyObj;
	} else {
		body = originalBody;
	}
	if (body !== null && typeof body === 'object' && endpoint.interceptBody) {
		endpoint.interceptBody(body as Record<string, unknown>);
	}

	// Get endpoint-specific fetch options (aligned with Copilot's endpoint.getEndpointFetchOptions())
	const endpointFetchOptions = endpoint.getEndpointFetchOptions?.();

	// Set up abort controller for cancellation
	let signal: IQuizAbortSignal | undefined;
	if (request.token) {
		const abortController = fetcher.makeAbortController();
		signal = abortController.signal;
		request.token.onCancellationRequested(() => {
			abortController.abort();
		});
	}

	const fetchOptions: IQuizFetchOptions = {
		callSite: request.callSite ?? 'quizNetworkRequest',
		headers: { ...endpoint.headers, ...standardHeaders },
		body: typeof body === 'string' ? body : JSON.stringify(body),
		method: request.method ?? 'POST',
		timeout: request.timeout ?? QUIZ_REQUEST_TIMEOUT_MS,
		json: typeof body === 'object' ? body : undefined,
		signal,
		suppressIntegrationId: endpointFetchOptions?.suppressIntegrationId,
	};

	if (typeof endpoint.urlOrRequestMetadata === 'string') {
		// Path A: Pure HTTP via IFetcherService
		// Used for: BYOK endpoints, xtab completions, WebSocket, string URLs
		const url = endpoint.urlOrRequestMetadata;
		const requestPromise = fetcher.fetch(url, fetchOptions).catch(reason => {
			if (canRetryOnce && canRetryOnceNetworkError(reason)) {
				// Disconnect and retry once if the connection was reset
				return fetcher.disconnectAll().then(() => {
					return fetcher.fetch(url, fetchOptions);
				});
			} else if (fetcher.isAbortError(reason)) {
				throw new CancellationError();
			} else {
				throw reason;
			}
		});
		const response = await requestPromise;
		return {
			status: 200,
			headers: {},
			body: response,
			headerRequestId: requestId,
		};
	} else {
		// Path B: CAPI SDK via IQuizQAPIClientService
		// Used for: Copilot official models, telemetry, ignore, code search, etc.
		const makeRequestOptions: IQuizMakeRequestOptions = {
			...fetchOptions,
			callSite: fetchOptions.callSite,
		};
		const response = await qapiClient.makeRequest(makeRequestOptions, endpoint.urlOrRequestMetadata);
		return {
			status: 200,
			headers: {},
			body: response,
			headerRequestId: requestId,
		};
	}
}

/**
 * Generate a unique request ID for telemetry and tracing.
 * Aligned with Copilot's generateUuid() usage for request IDs.
 */
function generateRequestId(): string {
	// Simple UUID v4-like generation
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

// #endregion

// #region quizNetworkRequestStream (aligned with Copilot's streaming network request)

/**
 * Pure function that implements the dual-path routing logic for streaming requests.
 * Aligned with Copilot's streaming network request pattern.
 *
 * Returns an async iterable of SSE-parsed chunks by:
 * 1. Routing to IQuizFetcherService.fetchStream() for HTTP path (string URL)
 * 2. Routing to IQuizQAPIClientService.makeRequest() for CAPI path (QuizRequestMetadata)
 * 3. Parsing the response stream through quizParseSSEStream()
 *
 * For the CAPI path, the response is a complete JSON object (not SSE),
 * so it's wrapped as a single chunk.
 */
export async function* quizNetworkRequestStream(
	fetcher: IQuizFetcherService,
	qapiClient: IQuizQAPIClientService,
	endpoint: IQuizNetworkRequestEndpoint,
	request: IQuizNetworkRequest,
	networkOptions?: IQuizNetworkRequestOptions,
): AsyncIterable<IQuizNetworkStreamChunk> {
	const canRetryOnce = networkOptions?.canRetryOnce ?? true;
	const requestId = request.headers?.['X-Request-Id'] ?? generateRequestId();

	// Build standard headers (same as quizNetworkRequest)
	const standardHeaders: Record<string, string> = {
		'X-Request-Id': requestId,
		'X-GitHub-Api-Version': '2026-01-09',
		'OpenAI-Intent': networkOptions?.intent ?? (typeof endpoint.urlOrRequestMetadata !== 'string' ? endpoint.urlOrRequestMetadata.type : 'chat'),
		...request.headers,
	};

	if (networkOptions?.secretKey) {
		standardHeaders['Authorization'] = `Bearer ${networkOptions.secretKey}`;
	}

	if (endpoint.getExtraHeaders) {
		Object.assign(standardHeaders, endpoint.getExtraHeaders(networkOptions?.location, networkOptions?.interactionTypeOverride));
	}

	// Intercept body
	const originalBody = request.body;
	let body: typeof originalBody;
	if (originalBody !== null && typeof originalBody === 'object') {
		const bodyObj: Record<string, unknown> = {};
		for (const key of Object.keys(originalBody)) {
			bodyObj[key] = (originalBody as Record<string, unknown>)[key];
		}
		body = bodyObj;
	} else {
		body = originalBody;
	}
	if (body !== null && typeof body === 'object' && endpoint.interceptBody) {
		endpoint.interceptBody(body as Record<string, unknown>);
	}

	const endpointFetchOptions = endpoint.getEndpointFetchOptions?.();

	// Set up abort controller
	let signal: IQuizAbortSignal | undefined;
	if (request.token) {
		const abortController = fetcher.makeAbortController();
		signal = abortController.signal;
		request.token.onCancellationRequested(() => {
			abortController.abort();
		});
	}

	const fetchOptions: IQuizFetchOptions = {
		callSite: request.callSite ?? 'quizNetworkRequestStream',
		headers: { ...endpoint.headers, ...standardHeaders },
		body: typeof body === 'string' ? body : JSON.stringify(body),
		method: request.method ?? 'POST',
		timeout: request.timeout ?? QUIZ_REQUEST_TIMEOUT_MS,
		json: typeof body === 'object' ? body : undefined,
		signal,
		suppressIntegrationId: endpointFetchOptions?.suppressIntegrationId,
	};

	if (typeof endpoint.urlOrRequestMetadata === 'string') {
		// Path A: HTTP streaming via IQuizFetcherService.fetchStream()
		const url = endpoint.urlOrRequestMetadata;
		let streamResponse: import('./quizFetcher.js').IQuizFetcherStreamResponse;
		try {
			streamResponse = await fetcher.fetchStream(url, fetchOptions);
		} catch (err) {
			if (canRetryOnce && canRetryOnceNetworkError(err)) {
				await fetcher.disconnectAll();
				streamResponse = await fetcher.fetchStream(url, fetchOptions);
			} else if (fetcher.isAbortError(err)) {
				return;
			} else {
				throw err;
			}
		}

		// Check for error status codes
		if (streamResponse.status >= 400) {
			// Read the error body from the stream
			let errorBody: string | null = null;
			for await (const chunk of streamResponse.stream) {
				errorBody = (errorBody ?? '') + (typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
			}
			let parsedBody: Record<string, unknown> | null = null;
			try { parsedBody = JSON.parse(errorBody ?? '{}'); } catch { /* not JSON */ }

			yield {
				data: parsedBody ?? { error: errorBody },
				isFinal: true,
				errorStatus: streamResponse.status,
			};
			return;
		}

		// Parse SSE stream into chunks
		const { quizParseSSEStream } = await import('../chat/quizChatStreamProcessor.js');
		for await (const sseEvent of quizParseSSEStream(streamResponse.stream, request.token)) {
			const data = sseEvent.data as Record<string, unknown> | null;
			if (!data) { continue; }

			// Determine if this is the final event
			const eventType = sseEvent.eventType;
			const isFinal = eventType === 'response.done' || eventType === 'done' ||
				(((data?.choices as Array<Record<string, unknown>> | undefined)?.some(c => c.finish_reason !== null)) ?? false);

			// Extract usage from final events
			let usage: IQuizNetworkStreamChunk['usage'];
			const response = data.response as Record<string, unknown> | undefined;
			if (data.usage) {
				const u = data.usage as Record<string, unknown>;
				usage = { promptTokens: (u.prompt_tokens as number) ?? 0, completionTokens: (u.completion_tokens as number) ?? 0, totalTokens: u.total_tokens !== undefined ? u.total_tokens as number : undefined };
			} else if (response?.usage) {
				const u = response.usage as Record<string, unknown>;
				usage = { promptTokens: (u.prompt_tokens as number) ?? 0, completionTokens: (u.completion_tokens as number) ?? 0, totalTokens: u.total_tokens !== undefined ? u.total_tokens as number : undefined };
			}

			// Extract finish reason
			let finishReason: string | undefined;
			const choices = data.choices as Array<Record<string, unknown>> | undefined;
			if (choices?.[0]?.finish_reason) {
				finishReason = String(choices[0].finish_reason);
			} else if (eventType === 'response.done' || eventType === 'response.completed') {
				finishReason = 'stop';
			}

			yield {
				data,
				isFinal,
				eventType,
				finishReason,
				usage,
			};
		}
	} else {
		// Path B: CAPI SDK via IQuizQAPIClientService.makeRequest()
		// CAPI returns a complete JSON response (not SSE), so wrap as single chunk
		const makeRequestOptions: IQuizMakeRequestOptions = {
			...fetchOptions,
			callSite: fetchOptions.callSite,
		};
		const response = await qapiClient.makeRequest(makeRequestOptions, endpoint.urlOrRequestMetadata);
		yield {
			data: response,
			isFinal: true,
		};
	}
}

// #endregion

// #region Null implementation

/** Null network service for testing */
export class NullQuizNetworkService implements IQuizNetworkService {
	declare readonly _serviceBrand: undefined;

	async networkRequest(_endpoint: IQuizNetworkRequestEndpoint, _request: IQuizNetworkRequest): Promise<IQuizNetworkResponse> {
		return { status: 200, headers: {}, body: {} };
	}

	async *networkRequestStream(_endpoint: IQuizNetworkRequestEndpoint, _request: IQuizNetworkRequest): AsyncIterable<IQuizNetworkStreamChunk> {
		yield { data: {}, isFinal: true };
	}

	async createWebSocketConnection(_endpoint: IQuizNetworkRequestEndpoint, _request: IQuizNetworkRequest): Promise<IQuizWebSocketStreamConnection> {
		return {
			send: () => { },
			close: () => { },
			stream: (async function* () { })(),
		};
	}
}

// #endregion
