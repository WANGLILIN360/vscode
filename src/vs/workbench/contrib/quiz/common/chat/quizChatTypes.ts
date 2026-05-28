/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/chat/common/commonTypes.ts
// Aligned with Copilot's platform/openai/node/fetch.ts

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region QuizChatLocation (aligned with Copilot's ChatLocation)

/**
 * The location of a chat request.
 * Aligned with Copilot's ChatLocation (platform/chat/common/commonTypes.ts).
 */
export enum QuizChatLocation {
	Panel = 1,
	Terminal = 2,
	Notebook = 3,
	Editor = 4,
	EditingSession = 5,
	Other = 6,
	Agent = 7,
}

export namespace QuizChatLocation {
	export function toString(chatLocation: QuizChatLocation): string {
		switch (chatLocation) {
			case QuizChatLocation.Editor: return 'conversationInline';
			case QuizChatLocation.Panel: return 'conversationPanel';
			case QuizChatLocation.EditingSession: return 'editingSession';
			case QuizChatLocation.Agent: return 'editingSessionAgent';
			default: return 'none';
		}
	}

	export function toStringShorter(chatLocation: QuizChatLocation): string {
		switch (chatLocation) {
			case QuizChatLocation.Editor:
			case QuizChatLocation.Notebook:
				return 'inline';
			case QuizChatLocation.Panel:
				return 'panel';
			case QuizChatLocation.EditingSession:
				return 'editingSession';
			default:
				return 'none';
		}
	}
}

// #endregion

// #region QuizFetchResponseKind (aligned with Copilot's FetchResponseKind)

/**
 * Top-level classification of a fetch response.
 * Aligned with Copilot's FetchResponseKind (platform/openai/node/fetch.ts).
 */
export enum QuizFetchResponseKind {
	Success = 'success',
	Failed = 'failed',
	Canceled = 'canceled',
}

// #endregion

// #region QuizChatFailKind (aligned with Copilot's ChatFailKind)

/**
 * Detailed failure classification for a chat request.
 * Aligned with Copilot's ChatFailKind (platform/openai/node/fetch.ts).
 */
export enum QuizChatFailKind {
	OffTopic = 'offTopic',
	TokenExpiredOrInvalid = 'tokenExpiredOrInvalid',
	ServerCanceled = 'serverCanceled',
	ClientNotSupported = 'clientNotSupported',
	RateLimited = 'rateLimited',
	QuotaExceeded = 'quotaExceeded',
	ExtensionBlocked = 'extensionBlocked',
	ServerError = 'serverError',
	ContentFilter = 'contentFilter',
	AgentUnauthorized = 'unauthorized',
	AgentFailedDependency = 'failedDependency',
	ValidationFailed = 'validationFailed',
	InvalidPreviousResponseId = 'invalidPreviousResponseId',
	NotFound = 'notFound',
	NetworkError = 'networkError',
	Unknown = 'unknown',
}

// #endregion

// #region QuizChatFetchResponseType (aligned with Copilot's ChatFetchResponseType)

/**
 * Response type for chat fetch operations.
 * Aligned with Copilot's ChatFetchResponseType (platform/chat/common/commonTypes.ts).
 */
export enum QuizChatFetchResponseType {
	OffTopic = 'offTopic',
	Canceled = 'canceled',
	Filtered = 'filtered',
	FilteredRetry = 'filteredRetry',
	PromptFiltered = 'promptFiltered',
	Length = 'length',
	RateLimited = 'rateLimited',
	QuotaExceeded = 'quotaExceeded',
	ExtensionBlocked = 'extensionBlocked',
	BadRequest = 'badRequest',
	NotFound = 'notFound',
	Failed = 'failed',
	Unknown = 'unknown',
	NetworkError = 'networkError',
	AgentUnauthorized = 'agent_unauthorized',
	AgentFailedDependency = 'agent_failed_dependency',
	InvalidStatefulMarker = 'invalid_stateful_marker',
	Success = 'success',
}

// #endregion

// #region QuizFilterReason (aligned with Copilot's FilterReason)

/**
 * Reason for content filtering.
 * Aligned with Copilot's FilterReason (platform/networking/common/openai.ts).
 */
export enum QuizFilterReason {
	Copyright = 'copyright',
	Prompt = 'prompt',
	Responsibility = 'responsibility',
}

// #endregion

// #region QuizAPIErrorResponse (aligned with Copilot's APIErrorResponse)

/**
 * Error response from the API.
 * Aligned with Copilot's APIErrorResponse.
 */
export interface IQuizAPIErrorResponse {
	readonly code: string;
	readonly message: string;
}

// #endregion

// #region QuizAPIUsage (aligned with Copilot's APIUsage)

/**
 * Token usage information from the API response.
 * Aligned with Copilot's APIUsage.
 */
export interface IQuizAPIUsage {
	readonly prompt_tokens: number;
	readonly completion_tokens: number;
	readonly total_tokens: number;
}

// #endregion

// #region Structured result types (aligned with Copilot's ChatResults / ChatRequestFailed / ChatRequestCanceled)

/**
 * Successful chat result with streaming completions.
 * Aligned with Copilot's ChatResults.
 */
export interface IQuizChatResults {
	type: QuizFetchResponseKind.Success;
	chatCompletions: AsyncIterable<IQuizChatCompletion>;
}

/**
 * Failed chat request with structured error info.
 * Aligned with Copilot's ChatRequestFailed.
 */
export interface IQuizChatRequestFailed {
	type: QuizFetchResponseKind.Failed;
	modelRequestId: string | undefined;
	failKind: QuizChatFailKind;
	reason: string;
	data?: Record<string, unknown>;
}

/**
 * Canceled chat request.
 * Aligned with Copilot's ChatRequestCanceled.
 */
export interface IQuizChatRequestCanceled {
	type: QuizFetchResponseKind.Canceled;
	reason: string;
}

/**
 * Union type for all chat fetch results.
 * Aligned with Copilot's ChatResults | ChatRequestFailed | ChatRequestCanceled.
 */
export type QuizChatFetchResult = IQuizChatResults | IQuizChatRequestFailed | IQuizChatRequestCanceled;

// #endregion

// #region QuizChatFetchError (aligned with Copilot's ChatFetchError)

/**
 * Detailed error from a chat fetch operation.
 * Aligned with Copilot's ChatFetchError (platform/chat/common/commonTypes.ts).
 */
export type QuizChatFetchError =
	| { type: QuizChatFetchResponseType.OffTopic; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.Canceled; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.Filtered; reason: string; reasonDetail?: string; category: QuizFilterReason; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.PromptFiltered; reason: string; reasonDetail?: string; category: QuizFilterReason; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.Length; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined; truncatedValue: string }
	| { type: QuizChatFetchResponseType.RateLimited; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined; retryAfter: number | undefined; rateLimitKey: string; isAuto: boolean; capiError?: IQuizAPIErrorResponse }
	| { type: QuizChatFetchResponseType.QuotaExceeded; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined; retryAfter: Date | undefined; capiError?: IQuizAPIErrorResponse }
	| { type: QuizChatFetchResponseType.ExtensionBlocked; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined; retryAfter: number; learnMoreLink: string }
	| { type: QuizChatFetchResponseType.BadRequest; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.NotFound; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.Failed; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined; streamError?: IQuizAPIErrorResponse }
	| { type: QuizChatFetchResponseType.NetworkError; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined; streamError?: IQuizAPIErrorResponse; isNetworkProcessCrash?: boolean }
	| { type: QuizChatFetchResponseType.Unknown; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.AgentUnauthorized; reason: string; reasonDetail?: string; authorizationUrl: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.AgentFailedDependency; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined }
	| { type: QuizChatFetchResponseType.InvalidStatefulMarker; reason: string; reasonDetail?: string; requestId: string; serverRequestId: string | undefined };

// #endregion

// #region QuizChatCompletion (aligned with Copilot's ChatCompletion)

/**
 * A single chat completion from the API.
 * Simplified version of Copilot's ChatCompletion for common/ layer.
 */
export interface IQuizChatCompletion {
	/** The completion text */
	readonly text: string;
	/** The finish reason (e.g., 'stop', 'length', 'tool_calls') */
	readonly finishReason: string;
	/** Token usage for this completion */
	readonly usage?: IQuizAPIUsage;
	/** Tool calls if present */
	readonly toolCalls?: IQuizToolCall[];
	/** The resolved model ID that generated this completion */
	readonly resolvedModel?: string;
	/** Model call ID for linking input/output messages */
	readonly modelCallId?: string;
}

/**
 * A tool call in a chat completion.
 */
export interface IQuizToolCall {
	readonly id: string;
	readonly name: string;
	readonly arguments: string;
}

// #endregion

// #region QuizFetchSuccess / QuizFetchResponse (aligned with Copilot's FetchSuccess / FetchResponse)

export type QuizFetchSuccess<T> = {
	type: QuizChatFetchResponseType.Success;
	value: T;
	requestId: string;
	serverRequestId: string | undefined;
	usage: IQuizAPIUsage | undefined;
	resolvedModel: string;
	modelCallId?: string;
};

export type QuizFetchResponse<T> = QuizFetchSuccess<T> | QuizChatFetchError;

export type QuizChatResponse = QuizFetchResponse<string>;
export type QuizChatResponses = QuizFetchResponse<string[]>;

// #endregion

// #region QuizResponseDelta (for streaming)

/**
 * A streaming delta from the chat endpoint.
 * Aligned with Copilot's IResponseDelta.
 */
export interface IQuizResponseDelta {
	/** Text content delta */
	text?: string;
	/** Tool call deltas */
	toolCalls?: IQuizToolCallDelta[];
	/** Thinking/reasoning content */
	thinking?: { text?: string; signature?: string };
	/** Finish reason */
	finishReason?: string;
	/** Usage information (typically on the last delta) */
	usage?: IQuizAPIUsage;
	/** Code vulnerability annotations */
	codeVulnAnnotations?: IQuizCodeVulnAnnotation[];
	/** Whether this is a copilot tool call stream update */
	copilotToolCallStreamUpdates?: unknown[];
}

/**
 * A tool call delta in a streaming response.
 */
export interface IQuizToolCallDelta {
	readonly index: number;
	readonly id?: string;
	readonly name?: string;
	readonly arguments?: string;
}

/**
 * Code vulnerability annotation.
 */
export interface IQuizCodeVulnAnnotation {
	readonly details: { type: string; message: string };
	readonly range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

// #endregion

// #region Constants

export const QUIZ_RESPONSE_CONTAINED_NO_CHOICES = 'Response contained no choices.';

export const QUIZ_CANCELED_MESSAGE = { message: 'Canceled' };

// #endregion

// #region QuizInteractionTypeOverride (aligned with Copilot's InteractionTypeOverride)

/**
 * Override for the X-Interaction-Type header.
 * Aligned with Copilot's InteractionTypeOverride.
 */
export type QuizInteractionTypeOverride = 'conversation-subagent' | 'conversation-compaction' | 'conversation-background';

// #endregion

// #region IQuizChatQuotaService (aligned with Copilot's IChatQuotaService)

export const IQuizChatQuotaService = createDecorator<IQuizChatQuotaService>('quizChatQuotaService');

/**
 * Service for tracking and reporting chat quota status.
 * Aligned with Copilot's IChatQuotaService.
 */
export interface IQuizChatQuotaService {
	readonly _serviceBrand: undefined;

	/** Process quota-related headers from a response */
	processQuotaHeaders(headers: Headers): void;

	/** Whether the quota is currently exceeded */
	readonly isQuotaExceeded: boolean;

	/** The date when the quota will reset */
	readonly quotaResetDate: string | undefined;
}

// #endregion

// #region QuizChatErrorDetails

/**
 * Error details for presenting to the user.
 * Aligned with Copilot's getErrorDetailsFromChatFetchError output.
 */
export interface IQuizChatErrorDetails {
	readonly message: string;
	readonly isQuotaExceeded?: boolean;
	readonly isRateLimited?: boolean;
	readonly responseIsFiltered?: boolean;
	readonly level?: 'info' | 'error';
}

// #endregion
