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
	readonly interactionTypeOverride?: 'conversation-subagent' | 'conversation-compaction' | 'conversation-background';
	/** Conversation ID for request-scoped state */
	readonly conversationId?: string;
	/** Turn ID within a conversation */
	readonly turnId?: string;
	/** Top-level turn ID for credit accumulation */
	readonly topLevelTurnId?: string;
	/** Custom metadata for logging */
	readonly customMetadata?: Record<string, string | number | boolean | undefined>;
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
	/** Edit tools supported by this model (e.g., 'apply-patch', 'find-replace') */
	readonly supportedEditTools: readonly string[] | undefined;

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
	/** Price category label */
	readonly priceCategory: string | undefined;
	/** Whether this is a fallback/utility model */
	readonly isFallback: boolean;

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

	/** Get all available chat model IDs */
	getAllModelIds(): Promise<string[]>;

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
	getAllModelIds(): Promise<string[]> { return Promise.resolve([]); }
	getIntentEndpoint(): Promise<undefined> { return Promise.resolve(undefined); }
}

// #endregion
