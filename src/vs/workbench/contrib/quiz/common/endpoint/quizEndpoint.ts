/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuizPromptMessage, IQuizToolCall, IQuizThinkingDelta, IQuizContextManagementResponse } from '../intents/quizIntents.js';
import { IQuizTokenUsage } from '../quizTypes.js';
export { IQuizTokenUsage } from '../quizTypes.js';
import { IQuizModelCapabilities } from './quizModelCapabilities.js';
import type { QuizRequestMetadata } from './quizQAPIClient.js';

// Re-export networking types for convenience (aligned with Copilot's endpoint routing)
export { QuizRequestType } from './quizQAPIClient.js';
export type { QuizRequestMetadata } from './quizQAPIClient.js';
export type { IQuizNetworkRequestEndpoint } from './quizNetwork.js';

// #region IQuizEndpointInfo (aligned with Copilot's IChatEndpoint read-only subset)

/**
 * Lightweight read-only endpoint information for prompt building decisions.
 * Aligned with the read-only subset of Copilot's IChatEndpoint.
 *
 * Unlike IQuizEndpoint, this does NOT expose sendChatRequest or other
 * mutation methods. It is intended for code paths that only need to
 * inspect model identity, capabilities, and token limits — e.g.,
 * prompt variant selection, tool schema normalization, token budgeting.
 *
 * Obtain via IQuizEndpoint.toEndpointInfo() or IQuizEndpointProvider.
 */
export interface IQuizEndpointInfo {
	// --- Identity
	readonly modelId: string;
	readonly name: string;
	readonly version: string;
	readonly family: string;
	readonly vendor: string;
	readonly modelProvider: string;
	/** Tokenizer type used by this model (e.g., 'o200k_base', 'cl100k_base') — aligned with Copilot's IEndpoint.tokenizer */
	readonly tokenizer: string;

	// --- Capabilities
	readonly supportsToolCalls: boolean;
	readonly supportsVision: boolean;
	readonly supportsPrediction: boolean;
	readonly supportsThinkingContentInHistory: boolean;
	readonly supportsAdaptiveThinking: boolean;
	readonly minThinkingBudget: number | undefined;
	readonly maxThinkingBudget: number | undefined;
	readonly supportsReasoningEffort: readonly string[] | undefined;
	readonly supportsToolSearch: boolean;
	readonly supportsContextEditing: boolean;
	readonly supportedEditTools: readonly QuizEndpointEditToolName[] | undefined;

	// --- Token limits
	readonly modelMaxPromptTokens: number;
	readonly maxOutputTokens: number;
	readonly maxPromptImages: number | undefined;

	// --- Pricing
	readonly isPremium: boolean | undefined;
	readonly multiplier: number | undefined;
	readonly restrictedToSkus: readonly string[] | undefined;
	readonly priceCategory: string | undefined;
	readonly isFallback: boolean;
	readonly tokenPricing?: IQuizEndpointTokenPricing;
	readonly customModel?: Record<string, unknown>;
	readonly isExtensionContributed?: boolean;

	// --- UI / UX
	readonly showInModelPicker: boolean;
	readonly degradationReason?: string;

	// --- Network routing (aligned with Copilot's IEndpoint.urlOrRequestMetadata)
	/** The endpoint URL or CAPI request metadata that determines the network routing path */
	readonly urlOrRequestMetadata?: string | QuizRequestMetadata;
	/** The API type this endpoint uses ('chatCompletions' | 'responses' | 'messages') */
	readonly apiType?: 'chatCompletions' | 'responses' | 'messages';
	/** Whether this endpoint owns its own authorization credentials */
	readonly ownsAuthorization?: boolean;

	// --- Availability
	readonly isAvailable: boolean;
}

// #endregion

// #region QuizEndpointErrorKind (aligned with Copilot's endpoint error classification)

/**
 * Classification of endpoint errors, aligned with Copilot's error handling
 * in ChatMLFetcherImpl.processError(). Used for retry decisions, telemetry,
 * and user-facing error messages.
 */
export const enum QuizEndpointErrorKind {
	/** Network connectivity lost */
	NetworkDisconnected = 'network_disconnected',
	/** Network process crashed (Electron) */
	NetworkProcessCrashed = 'network_process_crashed',
	/** Request was aborted/cancelled */
	Aborted = 'aborted',
	/** Rate limited by the API */
	RateLimited = 'rate_limited',
	/** Quota exceeded (user has no credits) */
	QuotaExceeded = 'quota_exceeded',
	/** Content filter blocked the response */
	ContentFiltered = 'content_filtered',
	/** Authentication failure (token expired/invalid) */
	AuthFailed = 'auth_failed',
	/** Server-side error (5xx) */
	ServerError = 'server_error',
	/** Model not found or not available */
	ModelNotFound = 'model_not_found',
	/** Context window exceeded */
	ContextLengthExceeded = 'context_length_exceeded',
	/** Invalid stateful marker (Responses API) */
	InvalidStatefulMarker = 'invalid_stateful_marker',
	/** Unknown/unclassified error */
	Unknown = 'unknown',
}

/**
 * Structured endpoint error with classification.
 * Aligned with Copilot's ChatMLFetcherImpl error handling.
 */
export interface IQuizEndpointError {
	/** Error classification */
	readonly kind: QuizEndpointErrorKind;
	/** Human-readable error message */
	readonly message: string;
	/** HTTP status code, if applicable */
	readonly statusCode?: number;
	/** Retry-After header value in ms, for rate limits */
	readonly retryAfterMs?: number;
	/** The underlying error, if any */
	readonly cause?: Error;
	/** Whether this error is expected (operational, not a bug) */
	readonly isExpectedError?: boolean;
}

/**
 * Check if an error is an IQuizEndpointError.
 */
export function isQuizEndpointError(error: unknown): error is IQuizEndpointError {
	return typeof error === 'object' && error !== null && 'kind' in error && 'message' in error;
}

/**
 * Create an IQuizEndpointError from an unknown thrown error.
 * Attempts to classify the error based on message patterns.
 */
export function quizEndpointErrorFromUnknown(error: unknown): IQuizEndpointError {
	if (isQuizEndpointError(error)) {
		return error;
	}
	const message = error instanceof Error ? error.message : String(error);
	const lower = message.toLowerCase();

	let kind = QuizEndpointErrorKind.Unknown;
	let statusCode: number | undefined;
	let retryAfterMs: number | undefined;

	if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
		kind = QuizEndpointErrorKind.RateLimited;
		statusCode = 429;
	} else if (lower.includes('quota') || lower.includes('credit')) {
		kind = QuizEndpointErrorKind.QuotaExceeded;
	} else if (lower.includes('content_filter') || lower.includes('content management') || lower.includes('filtered')) {
		kind = QuizEndpointErrorKind.ContentFiltered;
	} else if (lower.includes('unauthorized') || lower.includes('auth') || lower.includes('token') || lower.includes('401')) {
		kind = QuizEndpointErrorKind.AuthFailed;
		statusCode = 401;
	} else if (lower.includes('context_length') || lower.includes('max_tokens') || lower.includes('too many tokens')) {
		kind = QuizEndpointErrorKind.ContextLengthExceeded;
	} else if (lower.includes('invalid_stateful_marker') || lower.includes('previous_response_id')) {
		kind = QuizEndpointErrorKind.InvalidStatefulMarker;
	} else if (lower.includes('not found') || lower.includes('model_not_found') || lower.includes('404')) {
		kind = QuizEndpointErrorKind.ModelNotFound;
		statusCode = 404;
	} else if (lower.includes('network') || lower.includes('fetch') || lower.includes('connect')) {
		kind = QuizEndpointErrorKind.NetworkDisconnected;
	} else if (lower.includes('abort') || lower.includes('cancel')) {
		kind = QuizEndpointErrorKind.Aborted;
	} else if (lower.includes('5') && /5\d\d/.test(message)) {
		kind = QuizEndpointErrorKind.ServerError;
	}

	return {
		kind,
		message,
		statusCode,
		retryAfterMs,
		cause: error instanceof Error ? error : undefined,
		isExpectedError: kind !== QuizEndpointErrorKind.Unknown,
	};
}

// #endregion

// #region QuizEndpointEditToolName (aligned with Copilot's EndpointEditToolName)

/**
 * Edit tool names supported by model endpoints.
 * Aligned with Copilot's EndpointEditToolName from endpointProvider.ts.
 */
export type QuizEndpointEditToolName = 'find-replace' | 'multi-find-replace' | 'apply-patch' | 'code-rewrite';

const allQuizEndpointEditToolNames: ReadonlySet<QuizEndpointEditToolName> = new Set([
	'find-replace',
	'multi-find-replace',
	'apply-patch',
	'code-rewrite',
]);

/**
 * Type guard for QuizEndpointEditToolName.
 * Aligned with Copilot's isEndpointEditToolName.
 */
export function isQuizEndpointEditToolName(toolName: string): toolName is QuizEndpointEditToolName {
	return allQuizEndpointEditToolNames.has(toolName as QuizEndpointEditToolName);
}

// #endregion

// #region QuizModelSupportedEndpoint (aligned with Copilot's ModelSupportedEndpoint)

/**
 * API endpoints that a model may support.
 * Aligned with Copilot's ModelSupportedEndpoint from endpointProvider.ts.
 * Quiz primarily uses ILanguageModelsService which handles routing internally,
 * but this enum is useful for capability checks and request body construction.
 */
export const enum QuizModelSupportedEndpoint {
	/** OpenAI Chat Completions API */
	ChatCompletions = '/chat/completions',
	/** OpenAI Responses API */
	Responses = '/responses',
	/** WebSocket-based Responses API */
	WebSocketResponses = 'ws:/responses',
	/** Anthropic Messages API */
	Messages = '/v1/messages',
}

// #endregion

// #region IQuizTokenPriceTier / IQuizEndpointTokenPricing (aligned with Copilot's ITokenPriceTier / IChatEndpointTokenPricing)

/**
 * A single tier of normalized token pricing in AICs per million tokens.
 * Aligned with Copilot's ITokenPriceTier.
 */
export interface IQuizTokenPriceTier {
	/** Cost in AICs per million input tokens */
	readonly inputPrice: number;
	/** Cost in AICs per million output tokens */
	readonly outputPrice: number;
	/** Cost in AICs per million cached (read) tokens */
	readonly cacheReadTokenPrice: number;
	/** Largest prompt size (in tokens) billed at this tier's rates */
	readonly contextMax?: number;
}

/**
 * Normalized token pricing in AICs per million tokens, with tiered structure.
 * Aligned with Copilot's IChatEndpointTokenPricing.
 */
export interface IQuizEndpointTokenPricing {
	/** Default-context tier pricing */
	readonly default: IQuizTokenPriceTier;
	/** Long-context tier pricing, present only when rates differ from default */
	readonly longContext?: IQuizTokenPriceTier;
}

// #endregion

// #region QuizCustomDataPartMimeTypes (aligned with Copilot's CustomDataPartMimeTypes)

/**
 * Mime type constants for custom data parts in streaming responses.
 * Aligned with Copilot's CustomDataPartMimeTypes from endpointTypes.ts.
 * Used when parsing response streams from various LLM providers.
 */
export namespace QuizCustomDataPartMimeTypes {
	export const CacheControl = 'cache_control';
	export const StatefulMarker = 'stateful_marker';
	export const ThinkingData = 'thinking';
	export const ContextManagement = 'context_management';
	export const PhaseData = 'phase_data';
	export const Usage = 'usage';
}

export const QuizCacheType = 'ephemeral';

// #endregion

// #region IQuizEndpointBody (aligned with Copilot's IEndpointBody)

/**
 * Shape of a request body sent to the model endpoint.
 * Aligned with Copilot's IEndpointBody — a superset of parameters any request may carry.
 * Since Quiz bridges ILanguageModelsService, most of these are passed via request options
 * rather than as raw HTTP body fields.
 */
export interface IQuizEndpointBody {
	/** Model identifier override */
	model?: string;
	/** Tool definitions to send with the request */
	tools?: IQuizEndpointToolDefinition[];
	/** Tool choice strategy: 'none' | 'auto' | 'required' | { type: 'function'; name: string } */
	tool_choice?: IQuizToolChoice;
	/** Maximum output tokens the model should produce */
	max_output_tokens?: number;
	/** Sampling temperature */
	temperature?: number;
	/** Nucleus sampling parameter */
	top_p?: number;
	/** Whether to stream the response */
	stream?: boolean;
	/** Stream options (e.g., include_usage) */
	stream_options?: { include_usage?: boolean };
	/** Reasoning/thinking configuration */
	reasoning?: { effort?: string; summary?: string };
	/** Top-level reasoning effort (BYOK chat-completions shape) */
	reasoning_effort?: string;
	/** Anthropic-style thinking configuration */
	thinking?: { type: 'enabled' | 'disabled' | 'adaptive'; budget_tokens?: number };
	/** Prediction content for assisted generation */
	prediction?: { type: 'content'; content: string | { type: string; text: string }[] };
	/** Chat messages for the request */
	messages?: IQuizPromptMessage[];
	/** Responses API: previous response ID for stateful conversations */
	previous_response_id?: string;
	/** Responses API: input array */
	input?: unknown[];
	/** Responses API: truncation strategy */
	truncation?: 'auto' | 'disabled';
	/** Responses API: prompt cache key */
	prompt_cache_key?: string;
	/** Responses API: include encrypted reasoning content */
	include?: ['reasoning.encrypted_content'];
	/** Responses API: whether to store the response */
	store?: boolean;
	/** Responses API: output text verbosity */
	text?: { verbosity?: 'low' | 'medium' | 'high' };
	/** Context management for compaction */
	context_management?: IQuizContextManagementRequest;
	/** Stop sequences */
	stop?: string[];
	/** Number of completions to generate */
	n?: number;
	/** Anthropic Messages API: max_tokens (alias for max_output_tokens) */
	max_tokens?: number;
	/** OpenAI Chat Completions API: max_completion_tokens */
	max_completion_tokens?: number;
	/** Anthropic Messages API: output configuration */
	output_config?: { effort?: 'low' | 'medium' | 'high' };
	/** ChatCompletions API for Anthropic models: thinking budget */
	thinking_budget?: number;
	/** Intent flag for CAPI routing */
	intent?: boolean;
	/** Intent threshold for CAPI routing */
	intent_threshold?: number;
	/** State flag for CAPI routing */
	state?: 'enabled';
	/** Snippy (content filter) configuration */
	snippy?: { enabled: boolean };
	/** Top logprobs to include */
	top_logprobs?: number;
	/** Raw prompt string (for completions-style requests) */
	prompt?: string;
}

// #endregion

// #region IQuizEndpointFetchOptions (aligned with Copilot's IEndpointFetchOptions)

/**
 * Per-endpoint fetch options that control network request behavior.
 * Aligned with Copilot's IEndpointFetchOptions.
 */
export interface IQuizEndpointFetchOptions {
	/** Whether to suppress the integration ID header for this endpoint's requests */
	readonly suppressIntegrationId?: boolean;
}

// #endregion

// #region IQuizEndpointToolDefinition (aligned with Copilot's tool types)

/**
 * Tool definition in the format sent to the model API.
 * Covers OpenAI function tools, Anthropic tools, and Responses API tools.
 */
export interface IQuizEndpointFunctionTool {
	readonly type: 'function';
	readonly function: {
		readonly name: string;
		readonly description: string;
		readonly parameters?: object;
	};
}

export interface IQuizEndpointResponsesFunctionTool {
	readonly type: 'function';
	readonly name: string;
	readonly description: string;
	readonly parameters?: object;
}

export interface IQuizEndpointToolSearchTool {
	readonly type: 'tool_search';
	readonly execution: 'client';
	readonly description?: string;
	readonly parameters?: Record<string, unknown>;
}

export type IQuizEndpointToolDefinition =
	| IQuizEndpointFunctionTool
	| IQuizEndpointResponsesFunctionTool
	| IQuizEndpointToolSearchTool;

// #endregion

// #region IQuizToolChoice (aligned with Copilot's tool_choice)

/**
 * Tool choice directive for the model request.
 * Aligned with Copilot's OptionalChatRequestParams.tool_choice.
 */
export type IQuizToolChoice =
	| 'none'
	| 'auto'
	| 'required'
	| { type: 'function'; function: { name: string } };

// #endregion

// #region IQuizContextManagementRequest (aligned with Copilot's ContextManagement)

/**
 * Context management request for conversation compaction.
 * Supports both Anthropic and OpenAI context management formats.
 */
export interface IQuizContextManagementRequest {
	readonly type: 'context_management';
	/** Anthropic: applied edits */
	applied_edits?: unknown[];
	/** OpenAI: previous response ID */
	response_id?: string;
	/** OpenAI: input items to keep/drop */
	input?: unknown[];
}

// #endregion

// #region IQuizModelCapabilityOptions (aligned with Copilot's IModelCapabilityOptions)

/**
 * Per-request model capability opt-ins. All off by default.
 * Aligned with Copilot's IModelCapabilityOptions.
 */
export interface IQuizModelCapabilityOptions {
	/** Explicitly enable thinking for this request */
	enableThinking?: boolean;
	/** Reasoning effort level (e.g. 'low', 'medium', 'high') */
	reasoningEffort?: string;
	/** Enable the tool search tool for this request */
	enableToolSearch?: boolean;
	/** Enable context editing for this request */
	enableContextEditing?: boolean;
}

// #endregion

// #region IQuizInteractionTypeOverride (aligned with Copilot's InteractionTypeOverride)

/**
 * Override values for the X-Interaction-Type header.
 * Aligned with Copilot's InteractionTypeOverride from networking.ts.
 *
 * - 'conversation-subagent' — nested LLM calls made by a subagent inside an agent turn
 * - 'conversation-compaction' — mid-agent-turn history compaction
 * - 'conversation-background' — utility calls not tied to an active user turn
 */
export type IQuizInteractionTypeOverride = 'conversation-subagent' | 'conversation-compaction' | 'conversation-background';

// #endregion

// #region IQuizChatRequestTelemetryProperties (aligned with Copilot's IChatRequestTelemetryProperties)

/**
 * Structured telemetry properties for a chat request.
 * Aligned with Copilot's IChatRequestTelemetryProperties from networking.ts.
 * Used for subagent tracking, retry correlation, and connectivity diagnostics.
 */
export interface IQuizChatRequestTelemetryProperties {
	/** Request ID for correlation */
	requestId?: string;
	/** Message ID for correlation */
	messageId?: string;
	/** Conversation ID for correlation */
	conversationId?: string;
	/** Source of the message (e.g., 'agent', 'subagent') */
	messageSource?: string;
	/** Associated request ID for linking related requests */
	associatedRequestId?: string;
	/** Reason for retrying after an error */
	retryAfterError?: string;
	/** GitHub request ID from the retry error response */
	retryAfterErrorGitHubRequestId?: string;
	/** Error from connectivity test */
	connectivityTestError?: string;
	/** GitHub request ID from the connectivity test error response */
	connectivityTestErrorGitHubRequestId?: string;
	/** Category of content filter that triggered a retry */
	retryAfterFilterCategory?: string;
	/** A subtype for categorizing the request with a messageSource (e.g., 'subagent') */
	subType?: string;
	/** For a subagent: The request ID of the parent request that invoked this subagent */
	parentRequestId?: string;
	/** For a subagent: The tool_call_id from the parent agent's LLM response that triggered this subagent invocation */
	parentToolCallId?: string;
	/** For a subagent: The headerRequestId from the parent agent's fetch response that triggered this subagent invocation */
	parentHeaderRequestId?: string;
	/** For a subagent: The modelCallId from the parent agent's model call that triggered this subagent invocation */
	parentModelCallId?: string;
	/** The 0-based iteration number of the tool-calling loop that produced this request */
	iterationNumber?: string;
}

// #endregion

// #region IQuizChatRequestOptions (aligned with Copilot's IMakeChatRequestOptions)

/**
 * Options for a chat request to the model endpoint.
 * Aligned with Copilot's IMakeChatRequestOptions, adapted for Quiz's
 * bridge over ILanguageModelsService.
 */
export interface IQuizChatRequestOptions {
	/** Debug name for telemetry and logging */
	readonly debugName: string;
	/** Tool definitions to include in the request */
	readonly tools?: IQuizEndpointToolDefinition[];
	/** Tool choice directive */
	readonly toolChoice?: IQuizToolChoice;
	/** Per-request model capability opt-ins */
	readonly modelCapabilities?: IQuizModelCapabilityOptions;
	/** Maximum output tokens override */
	readonly maxOutputTokens?: number;
	/** Temperature override */
	readonly temperature?: number;
	/** Reasoning effort override */
	readonly reasoningEffort?: string;
	/** Whether to include usage in stream */
	readonly includeUsage?: boolean;
	/** Previous response ID for Responses API stateful conversations */
	readonly previousResponseId?: string;
	/** Context management data for compaction */
	readonly contextManagement?: IQuizContextManagementRequest;
	/** Prediction content for assisted generation */
	readonly prediction?: { type: 'content'; content: string | { type: string; text: string }[] };
	/** Whether this is a user-initiated request (for telemetry) */
	readonly userInitiatedRequest?: boolean;
	/** Whether this is a conversation request vs utility request */
	readonly isConversationRequest?: boolean;
	/** Enable retry on content filter */
	readonly enableRetryOnFilter?: boolean;
	/** Enable retry on error */
	readonly enableRetryOnError?: boolean;
	/** Interaction type override for telemetry */
	readonly interactionTypeOverride?: IQuizInteractionTypeOverride;
	/** Conversation ID for request-scoped state */
	readonly conversationId?: string;
	/** Turn ID within a conversation */
	readonly turnId?: string;
	/** Top-level turn ID for credit accumulation */
	readonly topLevelTurnId?: string;
	/** Custom metadata for logging */
	readonly customMetadata?: Record<string, string | number | boolean | undefined>;
	/** Enable WebSocket transport for this request when supported */
	readonly useWebSocket?: boolean;
	/** Disable Responses API stateful marker reuse */
	readonly ignoreStatefulMarker?: boolean;
	/** Indicates whether the request's mode instructions changed from the previous turn */
	readonly modeChanged?: boolean;
	/** The round ID at which the most recent client-side summarization occurred */
	readonly summarizedAtRoundId?: string;
	/** Enable retrying once on simple network errors like ECONNRESET */
	readonly canRetryOnceWithoutRollback?: boolean;
	/** (CAPI-only) Optional telemetry properties for analytics */
	readonly telemetryProperties?: IQuizChatRequestTelemetryProperties;
}

// #endregion

// #region IQuizChatResponseMetadata (aligned with Copilot's RequestId)

/**
 * Metadata extracted from a chat response, including request IDs and server info.
 * Aligned with Copilot's RequestId.
 */
export interface IQuizChatResponseMetadata {
	/** The request ID from the response header */
	readonly headerRequestId: string;
	/** The GitHub request ID from the response header */
	readonly gitHubRequestId: string;
	/** The completion ID from the response */
	readonly completionId: string;
	/** Server-assigned experiments */
	readonly serverExperiments: string;
	/** Deployment ID */
	readonly deploymentId: string;
	/** Token usage from the response */
	readonly usage?: IQuizTokenUsage;
}

// #endregion

// #region IQuizResponseDelta (aligned with Copilot's IResponseDelta)

/**
 * A streaming delta from the model response.
 * Aligned with Copilot's IResponseDelta — covers text, tool calls,
 * thinking, errors, confirmations, and context management.
 */
export interface IQuizResponseDelta {
	/** Incremental text content */
	text?: string;
	/** Complete tool calls in this delta */
	toolCalls?: IQuizToolCall[];
	/** Partial tool call updates (streaming) */
	toolCallStreamUpdates?: { name: string; arguments: string; id?: string }[];
	/** Begin tool call signals */
	beginToolCalls?: { name: string; id?: string }[];
	/** Thinking/reasoning data */
	thinking?: IQuizThinkingDelta;
	/** Phase marker (e.g., 'thinking', 'response') */
	phase?: string;
	/** Stateful marker for Responses API */
	statefulMarker?: string;
	/** Context management response (compaction) */
	contextManagement?: IQuizContextManagementResponse;
	/** Retry reason if the request was retried */
	retryReason?: 'content_filter' | 'network_error' | 'server_error';
	/** Token usage (typically in final delta) */
	usage?: IQuizTokenUsage;
	/** Error information */
	error?: { type: string; code: string; message: string };
	/** Finish reason (e.g., 'stop', 'tool_calls', 'length') — typically in final delta */
	finishReason?: string;
}

// #endregion

// #region IQuizEndpoint (aligned with Copilot's IChatEndpoint)

export const IQuizEndpoint = Symbol('IQuizEndpoint');

/**
 * A model endpoint that can send chat requests and provides model capabilities.
 * Aligned with Copilot's IChatEndpoint (from platform/networking/common/networking.ts).
 *
 * Quiz bridges VS Code's ILanguageModelsService rather than doing raw HTTP,
 * so some Copilot methods (makeChatRequest, createRequestBody, processResponseFromChatEndpoint)
 * are replaced by sendChatRequest with rich options. The bridge layer handles
 * converting Quiz types to/from ILanguageModelsService types internally.
 */
export interface IQuizEndpoint {
	/** Fires when the endpoint availability changes */
	readonly onDidChangeAvailability: Event<boolean>;

	// --- Identity (aligned with Copilot's IEndpoint + IChatEndpoint)

	/** The model identifier (may be 'copilot-utility' for fallback) */
	readonly modelId: string;
	/** Human-readable model name */
	readonly name: string;
	/** Model version string */
	readonly version: string;
	/** Model family (e.g., 'gpt-4', 'claude-3.5') — use this to switch behavior */
	readonly family: string;
	/** Model vendor (e.g., 'copilot', 'ollama') */
	readonly vendor: string;
	/** Model provider identifier */
	readonly modelProvider: string;
	/** Tokenizer type used by this model (e.g., 'o200k_base', 'cl100k_base') — aligned with Copilot's IEndpoint.tokenizer */
	readonly tokenizer: string;

	// --- Capabilities (aligned with Copilot's IChatEndpoint capabilities)

	/** Whether the model supports tool/function calling */
	readonly supportsToolCalls: boolean;
	/** Whether the model supports vision/image input */
	readonly supportsVision: boolean;
	/** Whether the model supports prediction/assisted generation */
	readonly supportsPrediction: boolean;
	/** Whether the model supports thinking/reasoning content in history */
	readonly supportsThinkingContentInHistory: boolean;
	/** Whether the model supports adaptive thinking */
	readonly supportsAdaptiveThinking: boolean;
	/** Minimum thinking budget (tokens) */
	readonly minThinkingBudget: number | undefined;
	/** Maximum thinking budget (tokens) */
	readonly maxThinkingBudget: number | undefined;
	/** Supported reasoning effort levels */
	readonly supportsReasoningEffort: readonly string[] | undefined;
	/** Whether the model supports tool search (Responses API) */
	readonly supportsToolSearch: boolean;
	/** Whether the model supports context editing */
	readonly supportsContextEditing: boolean;
	/** Edit tools supported by this model (aligned with Copilot's EndpointEditToolName) */
	readonly supportedEditTools: readonly QuizEndpointEditToolName[] | undefined;

	// --- Token limits (aligned with Copilot's IEndpoint.modelMaxPromptTokens + IChatEndpoint.maxOutputTokens)

	/** Maximum prompt tokens the model can accept */
	readonly modelMaxPromptTokens: number;
	/** Maximum output tokens the model can produce */
	readonly maxOutputTokens: number;
	/** Maximum number of images in a prompt */
	readonly maxPromptImages: number | undefined;

	// --- Pricing (aligned with Copilot's IChatEndpointTokenPricing)

	/** Whether this is a premium model */
	readonly isPremium: boolean | undefined;
	/** Billing multiplier for premium models */
	readonly multiplier: number | undefined;
	/** SKU restrictions for this model */
	readonly restrictedToSkus: readonly string[] | undefined;
	/** Price category label */
	readonly priceCategory: string | undefined;
	/** Whether this is a fallback/utility model */
	readonly isFallback: boolean;
	/** Normalized token pricing in AICs per million tokens */
	readonly tokenPricing?: IQuizEndpointTokenPricing;
	/** Custom model configuration (BYOK) */
	readonly customModel?: Record<string, unknown>;
	/** Whether this endpoint is contributed by an extension (not CAPI) */
	readonly isExtensionContributed?: boolean;

	// --- UI / UX (aligned with Copilot's IChatEndpoint)

	/** Whether this model should be shown in the model picker UI */
	readonly showInModelPicker: boolean;
	/** If the model is degraded, the reason (e.g., 'rate_limited', 'quota_exceeded') */
	readonly degradationReason?: string;

	// --- Network routing (aligned with Copilot's endpoint.urlOrRequestMetadata)

	/**
	 * The endpoint URL or CAPI request metadata that determines the network routing path.
	 * Aligned with Copilot's endpoint.urlOrRequestMetadata pattern.
	 *
	 * - **string URL** → HTTP path via IQuizFetcherService (BYOK, xtab, etc.)
	 * - **QuizRequestMetadata** → CAPI path via IQuizQAPIClientService (official Copilot models)
	 * - **undefined** → ILanguageModelsService bridge (default Quiz path)
	 *
	 * When undefined, sendChatRequest uses ILanguageModelsService internally.
	 * When set, sendChatRequest can route through IQuizNetworkService instead.
	 */
	readonly urlOrRequestMetadata?: string | QuizRequestMetadata;

	// --- Request customization (aligned with Copilot's IEndpoint + IChatEndpoint)

	/**
	 * Get extra HTTP headers to include in requests to this endpoint.
	 * Aligned with Copilot's IEndpoint.getExtraHeaders().
	 *
	 * Different endpoint types return different headers:
	 * - **Copilot models** → Anthropic beta headers, context management headers
	 * - **BYOK endpoints** → Authorization/api-key headers, custom headers
	 * - **Extension-contributed** → empty (handled by ILanguageModelsService)
	 *
	 * Called by quizNetworkRequest() to merge endpoint-specific headers
	 * into the request before sending.
	 */
	getExtraHeaders?(location?: string, interactionTypeOverride?: string): Record<string, string>;

	/**
	 * Get endpoint-specific fetch options.
	 * Aligned with Copilot's IEndpoint.getEndpointFetchOptions().
	 *
	 * Used to control per-endpoint behavior like suppressing the
	 * integration ID header for certain request types.
	 */
	getEndpointFetchOptions?(): IQuizEndpointFetchOptions;

	/**
	 * Intercept and modify the request body before sending.
	 * Aligned with Copilot's IEndpoint.interceptBody().
	 *
	 * Used for model-specific body transformations:
	 * - Remove tools from models that don't support them
	 * - Disable streaming for non-streaming models
	 * - Transform messages for o1-style models
	 */
	interceptBody?(body: IQuizEndpointBody): void;

	/**
	 * The API type this endpoint uses.
	 * Aligned with Copilot's IChatEndpoint.apiType.
	 * - 'chatCompletions' → OpenAI Chat Completions API
	 * - 'responses' → OpenAI Responses API
	 * - 'messages' → Anthropic Messages API
	 */
	readonly apiType?: 'chatCompletions' | 'responses' | 'messages';

	/**
	 * Whether this endpoint owns its own authorization credentials.
	 * Aligned with Copilot's IChatEndpoint.ownsAuthorization.
	 *
	 * When true, the fetcher must NOT fall back to the CAPI Copilot
	 * token for the Authorization header. Prevents leaking the user's
	 * CAPI bearer token to third-party endpoints.
	 */
	readonly ownsAuthorization?: boolean;

	// --- Methods (aligned with Copilot's IChatEndpoint methods)

	/** Check if the endpoint is currently available */
	isAvailable(): boolean;

	/**
	 * Send a chat request to the model with full options.
	 * Aligned with Copilot's makeChatRequest2 / makeChatRequest.
	 * Returns an async iterable of streaming deltas.
	 *
	 * @param messages The prompt messages to send
	 * @param options Request options including tools, tool_choice, capabilities, etc.
	 * @param token Cancellation token
	 */
	sendChatRequest(
		messages: readonly IQuizPromptMessage[],
		options: IQuizChatRequestOptions,
		token: CancellationToken,
	): AsyncIterable<IQuizResponseDelta>;

	/**
	 * Compute token count for a message using the model's tokenizer.
	 * Aligned with Copilot's IEndpoint.acquireTokenizer + ITokenizer.countTokens.
	 */
	computeTokenCount(message: string, token: CancellationToken): Promise<number>;

	/**
	 * Compute token count for a prompt message (including tool calls, thinking, etc.).
	 * Falls back to string-based estimation if the model doesn't support per-message counting.
	 */
	computeTokenCountForMessage?(message: IQuizPromptMessage, token: CancellationToken): Promise<number>;

	/**
	 * Create the request body that would be sent to the model endpoint.
	 * Useful for debugging and logging.
	 * Aligned with Copilot's IChatEndpoint.createRequestBody.
	 */
	createRequestBody?(messages: readonly IQuizPromptMessage[], options: IQuizChatRequestOptions): IQuizEndpointBody;

	/**
	 * Clone this endpoint with a different modelMaxPromptTokens value.
	 * Used for token budget management when the effective prompt limit changes.
	 * Aligned with Copilot's IChatEndpoint.cloneWithTokenOverride.
	 */
	cloneWithTokenOverride?(modelMaxPromptTokens: number): IQuizEndpoint;

	/**
	 * Get the model capabilities object for this endpoint.
	 */
	getCapabilities(): IQuizModelCapabilities;

	/**
	 * Extract a lightweight read-only snapshot of this endpoint's info.
	 * Used for prompt building decisions where request-sending is not needed.
	 * Aligned with Copilot's pattern of passing endpoint info without the
	 * full endpoint object to prompt construction code.
	 */
	toEndpointInfo(): IQuizEndpointInfo;
}

// #endregion

// #region IQuizEmbeddingsEndpoint (aligned with Copilot's IEmbeddingsEndpoint)

/**
 * Embeddings endpoint family, aligned with Copilot's EmbeddingsEndpointFamily.
 * Used to select which embeddings model to use when calling getEmbeddingsEndpoint().
 */
export type QuizEmbeddingsEndpointFamily = 'text3small' | 'metis';

/**
 * An embeddings endpoint that provides model identity and batch size information.
 * Aligned with Copilot's IEmbeddingsEndpoint (from platform/networking/common/networking.ts).
 *
 * Copilot's IEmbeddingsEndpoint extends IEndpoint with maxBatchSize.
 * Quiz's embeddings endpoint is a lightweight interface carrying only the
 * properties relevant to embeddings operations, since Quiz's full IQuizEndpoint
 * is a richer chat-oriented interface.
 */
export interface IQuizEmbeddingsEndpoint {
	/** Human-readable model name */
	readonly name: string;
	/** Model version string */
	readonly version: string;
	/** Model family identifier (e.g., 'text3small', 'metis') */
	readonly family: string;
	/** Tokenizer type used by this embeddings model */
	readonly tokenizer: string;
	/** Maximum number of inputs that can be batched in a single embeddings request */
	readonly maxBatchSize: number;
}

// #endregion

// #region IQuizEndpointProvider (aligned with Copilot's IEndpointProvider)

export const IQuizEndpointProvider = createDecorator<IQuizEndpointProvider>('quizEndpointProvider');

export interface IQuizEndpointProvider {
	readonly _serviceBrand: undefined;

	/** Get an endpoint by model ID */
	getEndpoint(modelId: string): IQuizEndpoint | undefined;

	/** Get the default endpoint using the standard Copilot model selector */
	getDefaultEndpoint(): Promise<IQuizEndpoint | undefined>;

	/** Get all available chat models (aligned with Copilot's IEndpointProvider.getAllCompletionModels) */
	getAllModels(): Promise<readonly IQuizEndpointInfo[]>;

	/** Get all available endpoints (aligned with Copilot's IEndpointProvider.getAllChatEndpoints) */
	getAllEndpoints(): Promise<readonly IQuizEndpoint[]>;

	/** Get endpoints filtered by model family (e.g., 'gpt-4', 'claude-3.5') */
	getEndpointsByFamily(family: string): Promise<readonly IQuizEndpoint[]>;

	/** Get the utility/fallback endpoint for lightweight tasks (aligned with Copilot's copilot-utility) */
	getUtilityEndpoint(): Promise<IQuizEndpoint | undefined>;

	/** Get an embeddings endpoint by family (aligned with Copilot's IEndpointProvider.getEmbeddingsEndpoint) */
	getEmbeddingsEndpoint(family?: QuizEmbeddingsEndpointFamily): Promise<IQuizEmbeddingsEndpoint | undefined>;

	/** Get an IQuizIntentEndpoint for the given model (for intent invocation) */
	getIntentEndpoint(modelId?: string): Promise<import('../intents/quizIntents.js').IQuizIntentEndpoint | undefined>;

	/** Fires when the set of available models changes */
	readonly onDidChangeModels: Event<void>;
}

/**
 * Null implementation that returns no endpoints.
 */
export class NullQuizEndpointProvider implements IQuizEndpointProvider {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeModels = Event.None;

	getEndpoint(_modelId: string): undefined { return undefined; }
	getDefaultEndpoint(): Promise<undefined> { return Promise.resolve(undefined); }
	getAllModels(): Promise<readonly IQuizEndpointInfo[]> { return Promise.resolve([]); }
	getAllEndpoints(): Promise<readonly IQuizEndpoint[]> { return Promise.resolve([]); }
	getEndpointsByFamily(_family: string): Promise<readonly IQuizEndpoint[]> { return Promise.resolve([]); }
	getUtilityEndpoint(): Promise<undefined> { return Promise.resolve(undefined); }
	getEmbeddingsEndpoint(): Promise<undefined> { return Promise.resolve(undefined); }
	getIntentEndpoint(): Promise<undefined> { return Promise.resolve(undefined); }
}

// #endregion
