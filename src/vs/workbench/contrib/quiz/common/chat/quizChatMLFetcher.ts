/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/chat/common/chatMLFetcher.ts
// and extension/prompt/node/chatMLFetcher.ts (ChatMLFetcherImpl)

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuizEndpoint, IQuizChatRequestTelemetryProperties } from '../endpoint/quizEndpoint.js';
import { QuizChatLocation, QuizInteractionTypeOverride, QuizChatFetchResult } from './quizChatTypes.js';
import { QuizFinishedCallback } from './quizChatStreamProcessor.js';

// #region IQuizChatMLFetcher (aligned with Copilot's IChatMLFetcher)

export const IQuizChatMLFetcher = createDecorator<IQuizChatMLFetcher>('quizChatMLFetcher');

/**
 * The central dispatcher for all LLM chat requests in Quiz.
 * Aligned with Copilot's IChatMLFetcher (platform/chat/common/chatMLFetcher.ts)
 * and ChatMLFetcherImpl (extension/prompt/node/chatMLFetcher.ts).
 *
 * This is the "ChatMLFetcher" equivalent — the single entry point through which
 * all Quiz LLM requests pass. It handles:
 *
 * 1. Authentication token injection (copilotToken fallback for secretKey)
 * 2. ownsAuthorization checks (BYOK endpoints skip CAPI token)
 * 3. Dual-path routing (HTTP via IQuizFetcherService, CAPI via IQuizQAPIClientService)
 * 4. WebSocket path with automatic HTTP fallback on failure
 * 5. Streaming response processing (SSE parsing, delta accumulation)
 * 6. Structured error classification (QuizChatFailKind, QuizChatFetchResponseType)
 * 7. Retry logic (network error retry once, stateful marker retry)
 * 8. Telemetry events (request.sent, request.response, request.error)
 * 9. Quota header processing
 * 10. Request logging
 */
export interface IQuizChatMLFetcher {
	readonly _serviceBrand: undefined;

	/**
	 * Emitted after a chat ML request is made.
	 * Aligned with Copilot's IChatMLFetcher.onDidMakeChatMLRequest.
	 */
	readonly onDidMakeChatMLRequest: Event<IQuizMadeChatRequestEvent>;

	/**
	 * Fetch a single chat completion.
	 * Aligned with Copilot's IChatMLFetcher.fetchOne().
	 */
	fetchOne(options: IQuizFetchMLOptions, token: CancellationToken): Promise<QuizChatFetchResult>;

	/**
	 * Fetch multiple chat completions (n > 1).
	 * Aligned with Copilot's IChatMLFetcher.fetchMany().
	 * The returned array may be less than n (e.g., in case of errors during streaming).
	 */
	fetchMany(options: IQuizFetchMLOptions, token: CancellationToken): Promise<QuizChatFetchResult>;
}

// #endregion

// #region IQuizFetchMLOptions (aligned with Copilot's IFetchMLOptions)

/**
 * Options for a ChatML fetch operation.
 * Aligned with Copilot's IFetchMLOptions.
 */
export interface IQuizFetchMLOptions {
	/** The endpoint to send the request to */
	endpoint: IQuizEndpoint;

	/** The request options (temperature, max_tokens, n, etc.) */
	requestOptions: IQuizOptionalChatRequestParams;

	/** Debug name for telemetry and logging */
	debugName: string;

	/** The chat location (panel, editor, etc.) */
	location: QuizChatLocation;

	/** Callback invoked as streaming response arrives */
	finishedCb?: QuizFinishedCallback;

	/** Telemetry properties to attach */
	telemetryProperties?: IQuizChatRequestTelemetryProperties;

	/** Whether the request was initiated by the user (vs. agent/system) */
	userInitiatedRequest?: boolean;

	/** Whether to use WebSocket transport (if available) */
	useWebSocket?: boolean;

	/** Whether to retry on content filter errors */
	enableRetryOnFilter?: boolean;

	/** Whether to retry on general errors */
	enableRetryOnError?: boolean;

	/** Whether to retry once on network error without rollback */
	canRetryOnceWithoutRollback?: boolean;

	/** Override for X-Interaction-Type header */
	interactionTypeOverride?: QuizInteractionTypeOverride;

	/** Conversation ID for WebSocket and stateful marker */
	conversationId?: string;

	/** Turn ID for WebSocket */
	turnId?: string;

	/** Top-level turn ID for subagent requests */
	topLevelTurnId?: string;

	/** Whether to ignore the stateful marker on this request */
	ignoreStatefulMarker?: boolean;

	/** Whether this is a conversation request (vs. background) */
	isConversationRequest?: boolean;

	/** Custom metadata for telemetry */
	customMetadata?: Record<string, unknown>;

	/** Source identifier for telemetry */
	source?: IQuizFetchSource;

	/** The round ID at which summarization occurred */
	summarizedAtRoundId?: string;

	/** Whether the mode changed (ask → agent or vice versa) */
	modeChanged?: boolean;
}

// #endregion

// #region IQuizOptionalChatRequestParams (aligned with Copilot's OptionalChatRequestParams)

/**
 * Optional parameters for a chat request.
 * Aligned with Copilot's OptionalChatRequestParams.
 */
export interface IQuizOptionalChatRequestParams {
	/** Number of completions to generate */
	n?: number;
	/** Maximum tokens for the response */
	max_tokens?: number;
	/** Maximum output tokens (Responses API) */
	max_output_tokens?: number;
	/** Maximum completion tokens */
	max_completion_tokens?: number;
	/** Sampling temperature */
	temperature?: number;
	/** Top-p (nucleus) sampling */
	top_p?: number;
	/** Whether to stream the response */
	stream?: boolean;
	/** Prediction for speculative decoding */
	prediction?: { content: string };
	/** Secret key for BYOK endpoints */
	secretKey?: string;
	/** Stop sequences */
	stop?: string | string[];
	/** Tool choice override */
	tool_choice?: unknown;
	/** Response format */
	response_format?: unknown;
}

// #endregion

// #region IQuizMadeChatRequestEvent (aligned with Copilot's IMadeChatRequestEvent)

/**
 * Event emitted after a chat ML request is made.
 * Aligned with Copilot's IMadeChatRequestEvent.
 */
export interface IQuizMadeChatRequestEvent {
	readonly model: string;
	readonly source?: IQuizFetchSource;
	readonly tokenCount?: number;
}

// #endregion

// #region IQuizFetchSource (aligned with Copilot's Source)

/**
 * Source of a chat request.
 * Aligned with Copilot's Source.
 */
export interface IQuizFetchSource {
	readonly extensionId?: string;
}

// #endregion

// Re-export IQuizChatRequestTelemetryProperties from quizEndpoint.ts
export type { IQuizChatRequestTelemetryProperties } from '../endpoint/quizEndpoint.js';
