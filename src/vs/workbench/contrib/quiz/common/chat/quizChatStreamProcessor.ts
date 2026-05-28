/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/networking/node/chatStream.ts and
// platform/endpoint/node/chatEndpoint.ts (processResponseFromChatEndpoint)
//
// Handles SSE (Server-Sent Events) parsing and response stream processing
// for both HTTP and WebSocket transport paths.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizResponseDelta, IQuizChatCompletion, IQuizAPIUsage, IQuizToolCall, QuizChatFetchResponseType } from './quizChatTypes.js';

// #region SSE Parser (aligned with Copilot's SSE parsing in chatStream.ts)

/**
 * Parse a Server-Sent Events (SSE) stream into individual event objects.
 * Aligned with Copilot's SSE parsing logic in chatStream.ts.
 *
 * SSE format:
 * ```
 * event: response.done
 * data: {"type":"response.done",...}
 *
 * event: response.output_item.done
 * data: {"type":"response.output_item.done",...}
 * ```
 */
export async function* quizParseSSEStream(
	stream: AsyncIterable<Uint8Array | string>,
	token?: CancellationToken,
): AsyncIterable<IQuizSSEEvent> {
	let buffer = '';
	for await (const chunk of stream) {
		if (token?.isCancellationRequested) {
			return;
		}
		const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
		buffer += text;

		// Split on double newlines (SSE event boundary)
		const parts = buffer.split('\n\n');
		// Last part may be incomplete — keep it in the buffer
		buffer = parts.pop() ?? '';

		for (const part of parts) {
			const event = quizParseSSEEvent(part);
			if (event) {
				yield event;
			}
		}
	}

	// Process any remaining data in the buffer
	if (buffer.trim()) {
		const event = quizParseSSEEvent(buffer);
		if (event) {
			yield event;
		}
	}
}

/**
 * A parsed SSE event.
 */
export interface IQuizSSEEvent {
	/** The event type (e.g., 'response.done', 'response.output_item.done') */
	readonly eventType: string;
	/** The parsed data payload */
	readonly data: unknown;
}

/**
 * Parse a single SSE event block into an IQuizSSEEvent.
 */
function quizParseSSEEvent(block: string): IQuizSSEEvent | null {
	let eventType = '';
	const dataLines: string[] = [];

	for (const line of block.split('\n')) {
		if (line.startsWith('event:')) {
			eventType = line.substring(6).trim();
		} else if (line.startsWith('data:')) {
			dataLines.push(line.substring(5).trim());
		} else if (line.startsWith('id:')) {
			// SSE event ID — not currently used
		} else if (line.startsWith('retry:')) {
			// SSE retry directive — not currently used
		}
	}

	if (dataLines.length === 0) {
		return null;
	}

	const dataStr = dataLines.join('\n');
	if (dataStr === '[DONE]') {
		return { eventType: eventType || 'done', data: null };
	}

	try {
		const data = JSON.parse(dataStr);
		return { eventType: eventType || (data as Record<string, unknown>)?.type as string || 'message', data };
	} catch {
		return { eventType: eventType || 'message', data: dataStr };
	}
}

// #endregion

// #region QuizFetchStreamSource (aligned with Copilot's FetchStreamSource)

/**
 * Manages a stream of response parts for a single chat request.
 * Aligned with Copilot's FetchStreamSource (platform/chat/common/chatMLFetcher.ts).
 *
 * Supports pause/unpause for coordinating between tool call processing
 * and response streaming.
 */
export class QuizFetchStreamSource {
	private _resolve: (() => void) | null = null;
	private _reject: ((error: Error) => void) | null = null;
	private _paused: (IQuizResponsePart | undefined)[] | undefined;
	private _seenAnnotationTypes = new Set<string>();

	/**
	 * The async iterable of response parts.
	 * Consumers iterate this to receive streaming updates.
	 */
	readonly stream: AsyncIterable<IQuizResponsePart>;

	constructor() {
		const source = this;
		this.stream = {
			[Symbol.asyncIterator]() {
				return {
					next() {
						return new Promise<IteratorResult<IQuizResponsePart>>((resolve, reject) => {
							source._resolve = () => resolve({ done: true, value: undefined });
							source._reject = reject;
						});
					},
				};
			},
		};
	}

	/** Pause buffering of events */
	pause(): void {
		this._paused ??= [];
	}

	/** Unpause and flush buffered events */
	unpause(): void {
		const toEmit = this._paused;
		if (!toEmit) {
			return;
		}
		this._paused = undefined;
		for (const part of toEmit) {
			if (part) {
				this.update(part.text, part.delta);
			} else {
				this.resolve();
			}
		}
	}

	/** Emit a response part with text and delta */
	update(text: string, delta: IQuizResponseDelta): void {
		if (this._paused) {
			this._paused.push({ text, delta });
			return;
		}

		// Filter duplicate vulnerability annotations
		if (delta.codeVulnAnnotations) {
			delta.codeVulnAnnotations = delta.codeVulnAnnotations.filter(
				a => !this._seenAnnotationTypes.has(a.details.type)
			);
			delta.codeVulnAnnotations.forEach(a => this._seenAnnotationTypes.add(a.details.type));
		}

		// Note: Full AsyncIterableSource emission would be implemented here
		// when integrating with VS Code's async utilities
	}

	/** Signal that the stream is complete */
	resolve(): void {
		if (this._paused) {
			this._paused.push(undefined);
			return;
		}
		this._resolve?.();
		this._resolve = null;
	}

	/** Signal that the stream encountered an error */
	reject(error: Error): void {
		this._paused = undefined;
		this._reject?.(error);
		this._reject = null;
	}
}

/**
 * A response part emitted by the stream source.
 * Aligned with Copilot's IResponsePart.
 */
export interface IQuizResponsePart {
	readonly text: string;
	readonly delta: IQuizResponseDelta;
}

// #endregion

// #region QuizFetchStreamRecorder (aligned with Copilot's FetchStreamRecorder)

/**
 * Records all deltas from a stream for post-processing.
 * Aligned with Copilot's FetchStreamRecorder.
 */
export class QuizFetchStreamRecorder {
	readonly deltas: IQuizResponseDelta[] = [];
	private _firstTokenEmittedTime: number | undefined;

	get firstTokenEmittedTime(): number | undefined {
		return this._firstTokenEmittedTime;
	}

	/**
	 * Create a finished callback that records deltas.
	 * Aligned with Copilot's FetchStreamRecorder constructor.
	 */
	createCallback(): QuizFinishedCallback {
		return async (text: string, index: number, delta: IQuizResponseDelta): Promise<number | undefined> => {
			if (this._firstTokenEmittedTime === undefined && (delta.text || delta.toolCalls || delta.thinking?.text)) {
				this._firstTokenEmittedTime = Date.now();
			}
			this.deltas.push(delta);
			return undefined;
		};
	}
}

/**
 * Callback invoked when a streaming response finishes.
 * Aligned with Copilot's FinishedCallback.
 */
export type QuizFinishedCallback = (text: string, index: number, delta: IQuizResponseDelta) => Promise<number | undefined>;

// #endregion

// #region Response processing (aligned with Copilot's processResponseFromChatEndpoint)

/**
 * Process a streaming HTTP response into chat completions.
 * Aligned with Copilot's processResponseFromChatEndpoint.
 *
 * Supports two API formats:
 * 1. OpenAI Chat Completions API (data: {"choices":[{"delta":...}]})
 * 2. OpenAI Responses API (data: {"type":"response.output_text.delta",...})
 */
export async function* quizProcessStreamResponse(
	stream: AsyncIterable<Uint8Array | string>,
	nChoices: number,
	finishedCb: QuizFinishedCallback,
	token?: CancellationToken,
): AsyncIterable<IQuizChatCompletion> {
	const completions: QuizStreamCompletionBuilder[] = [];
	for (let i = 0; i < nChoices; i++) {
		completions.push(new QuizStreamCompletionBuilder());
	}

	for await (const sseEvent of quizParseSSEStream(stream, token)) {
		if (token?.isCancellationRequested) {
			return;
		}

		const data = sseEvent.data as Record<string, unknown> | null;
		if (!data) {
			continue;
		}

		// OpenAI Chat Completions API format
		if (Array.isArray(data.choices)) {
			for (const choice of data.choices as Array<Record<string, unknown>>) {
				const index = (choice.index as number) ?? 0;
				if (index < completions.length) {
					const delta = choice.delta as Record<string, unknown> | undefined;
					if (delta) {
						const text = (delta.content as string) ?? '';
						const responseDelta: IQuizResponseDelta = { text };
						if (delta.tool_calls) {
							responseDelta.toolCalls = (delta.tool_calls as Array<Record<string, unknown>>).map(tc => ({
								index: (tc.index as number) ?? 0,
								id: tc.id as string | undefined,
								name: (tc.function as Record<string, unknown> | undefined)?.name as string | undefined,
								arguments: (tc.function as Record<string, unknown> | undefined)?.arguments as string | undefined,
							}));
						}
						if (choice.finish_reason) {
							responseDelta.finishReason = choice.finish_reason as string;
						}
						completions[index].appendDelta(text, responseDelta);
						await finishedCb(completions[index].text, index, responseDelta);
					}
					if (choice.finish_reason) {
						completions[index].finishReason = choice.finish_reason as string;
					}
				}
			}
			if (data.usage) {
				// Attach usage to the first completion
				completions[0].usage = data.usage as IQuizAPIUsage;
			}
			continue;
		}

		// OpenAI Responses API format
		if (data.type) {
			const eventType = data.type as string;
			if (eventType === 'response.output_text.delta' || eventType === 'response.text.delta') {
				const text = (data.delta as string) ?? '';
				const responseDelta: IQuizResponseDelta = { text };
				completions[0].appendDelta(text, responseDelta);
				await finishedCb(completions[0].text, 0, responseDelta);
			} else if (eventType === 'response.completed' || eventType === 'response.done') {
				const response = data.response as Record<string, unknown> | undefined;
				if (response?.usage) {
					completions[0].usage = response.usage as IQuizAPIUsage;
				}
				if (response?.model) {
					completions[0].resolvedModel = response.model as string;
				}
				completions[0].finishReason = 'stop';
			} else if (eventType === 'response.function_call_arguments.delta') {
				const args = (data.delta as string) ?? '';
				const responseDelta: IQuizResponseDelta = {
					toolCalls: [{ index: 0, arguments: args }],
				};
				completions[0].appendToolCallArgs(args);
				await finishedCb(completions[0].text, 0, responseDelta);
			}
			continue;
		}
	}

	// Yield completed completions
	for (const builder of completions) {
		if (builder.text || builder.toolCalls.length > 0) {
			yield builder.toChatCompletion();
		}
	}
}

// #endregion

// #region QuizStreamCompletionBuilder (internal helper)

/**
 * Builds a chat completion from streaming deltas.
 */
class QuizStreamCompletionBuilder {
	text = '';
	finishReason: string | undefined;
	usage: IQuizAPIUsage | undefined;
	resolvedModel: string | undefined;
	toolCalls: IQuizToolCall[] = [];
	private _toolCallArgs: Map<number, string> = new Map();
	private _toolCallNames: Map<number, string> = new Map();
	private _toolCallIds: Map<number, string> = new Map();

	appendDelta(text: string, delta: IQuizResponseDelta): void {
		this.text += text;
		if (delta.toolCalls) {
			for (const tc of delta.toolCalls) {
				if (tc.id) {
					this._toolCallIds.set(tc.index, tc.id);
				}
				if (tc.name) {
					this._toolCallNames.set(tc.index, tc.name);
				}
				if (tc.arguments) {
					const existing = this._toolCallArgs.get(tc.index) ?? '';
					this._toolCallArgs.set(tc.index, existing + tc.arguments);
				}
			}
		}
		if (delta.finishReason) {
			this.finishReason = delta.finishReason;
		}
		if (delta.usage) {
			this.usage = delta.usage;
		}
	}

	appendToolCallArgs(args: string): void {
		const existing = this._toolCallArgs.get(0) ?? '';
		this._toolCallArgs.set(0, existing + args);
	}

	toChatCompletion(): IQuizChatCompletion {
		// Build tool calls from accumulated data
		this.toolCalls = [];
		for (const [index, args] of this._toolCallArgs) {
			this.toolCalls.push({
				id: this._toolCallIds.get(index) ?? '',
				name: this._toolCallNames.get(index) ?? '',
				arguments: args,
			});
		}

		return {
			text: this.text,
			finishReason: this.finishReason ?? 'stop',
			usage: this.usage,
			resolvedModel: this.resolvedModel,
			toolCalls: this.toolCalls.length > 0 ? this.toolCalls : undefined,
		};
	}
}

// #endregion

// #region Error handling utilities (aligned with Copilot's error classification)

/**
 * Classify an HTTP status code and response body into a QuizChatFetchResponseType.
 * Aligned with Copilot's error classification in chatMLFetcher.ts.
 */
export function quizClassifyFetchError(
	status: number,
	body: Record<string, unknown> | null,
	requestId: string,
	serverRequestId: string | undefined,
): QuizChatFetchResponseType {
	if (status === 0) {
		return QuizChatFetchResponseType.NetworkError;
	}

	// Check for CAPI error structure
	const capiError = body?.error as Record<string, unknown> | undefined;
	const capiCode = capiError?.code as string | undefined;

	if (status === 400) {
		if (capiCode === 'invalid_stateful_marker' || capiCode === 'invalid_previous_response_id') {
			return QuizChatFetchResponseType.InvalidStatefulMarker;
		}
		return QuizChatFetchResponseType.BadRequest;
	}
	if (status === 401) {
		return QuizChatFetchResponseType.Failed;
	}
	if (status === 403) {
		if (capiCode === 'off_topic') {
			return QuizChatFetchResponseType.OffTopic;
		}
		if (capiCode === 'content_filter' || capiCode === 'responsible_ai_filter') {
			return QuizChatFetchResponseType.Filtered;
		}
		if (capiCode === 'prompt_filter') {
			return QuizChatFetchResponseType.PromptFiltered;
		}
		return QuizChatFetchResponseType.Failed;
	}
	if (status === 404) {
		return QuizChatFetchResponseType.NotFound;
	}
	if (status === 429) {
		if (capiCode?.startsWith('quota_') || capiCode === 'free_quota_exceeded') {
			return QuizChatFetchResponseType.QuotaExceeded;
		}
		return QuizChatFetchResponseType.RateLimited;
	}
	if (status === 422) {
		return QuizChatFetchResponseType.BadRequest;
	}
	if (status === 424) {
		return QuizChatFetchResponseType.AgentFailedDependency;
	}
	if (status === 503) {
		return QuizChatFetchResponseType.Failed;
	}
	if (status >= 500) {
		return QuizChatFetchResponseType.Failed;
	}

	return QuizChatFetchResponseType.Unknown;
}

/**
 * Build a QuizChatFetchError from an HTTP error response.
 */
export function quizBuildFetchError(
	responseType: QuizChatFetchResponseType,
	status: number,
	body: Record<string, unknown> | null,
	requestId: string,
	serverRequestId: string | undefined,
	retryAfter?: number,
): QuizChatFetchResponseType {
	// Return the classified type — callers can construct the full error object
	return responseType;
}

// #endregion
