/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { ResourceMap, ResourceSet } from '../../../../../base/common/map.js';
import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatAgentRequest } from '../../../chat/common/participants/chatAgents.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { IQuizInternalToolReference, IQuizToolGrouping } from '../prompt/quizToolReferences.js';
export { IQuizInternalToolReference, IQuizToolGrouping } from '../prompt/quizToolReferences.js';
import type { QuizPromptMetadata } from '../prompt/quizConversation.js';
import type { IQuizWorkingSet, QuizTextDocumentSnapshot, QuizNotebookDocumentSnapshot } from '../prompt/quizWorkingSet.js';
import { IQuizRange, IQuizLocation } from '../quizSharedTypes.js';

// Re-export shared types for consumers of this module
export { IQuizRange, IQuizLocation } from '../quizSharedTypes.js';
export { QuizPromptMetadata } from '../prompt/quizConversation.js';

// #region Thinking data types (aligned with Copilot's ThinkingData — defined here to avoid circular imports)

/**
 * Represents thinking/reasoning data from a model response.
 * Supports both plain text and encrypted thinking data.
 */
export interface IQuizThinkingData {
	id?: string;
	text: string | string[];
	metadata?: { [key: string]: unknown };
	tokens?: number;
	encrypted?: string;

	// Azure OpenAI fields for completions
	cotId?: string;
	cotSummary?: string;

	// Copilot API fields for completions
	reasoningOpaque?: string;
	reasoningText?: string;
}

/**
 * Delta format for incremental thinking data received during streaming.
 * Aligned with Copilot's ThinkingDelta and RawThinkingDelta.
 */
export interface IQuizThinkingDelta {
	id?: string;
	text?: string | string[];
	metadata?: { [key: string]: unknown };
	encrypted?: string;

	// Azure OpenAI fields
	cotId?: string;
	cotSummary?: string;

	// Copilot API fields
	reasoningOpaque?: string;
	reasoningText?: string;

	// Anthropic fields
	thinking?: string;
	signature?: string;
}

export function isQuizEncryptedThinkingDelta(delta: IQuizThinkingDelta): boolean {
	return !!(delta && delta.encrypted !== undefined);
}

/**
 * Represents a context management response from the Responses API.
 * Used for compaction and round-tripping in outgoing requests.
 */
export interface IQuizContextManagementResponse {
	readonly type: 'context_management';
	readonly responseId: string;
	readonly data: unknown;
}

// #endregion

// #region Edited file event (aligned with Copilot's ChatRequestEditedFileEvent)

export const enum QuizEditedFileEventKind {
	Keep = 1,
	Undo = 2,
	UserModification = 3,
}

export interface IQuizEditedFileEvent {
	readonly uri: URI;
	readonly eventKind: QuizEditedFileEventKind;
}

// #endregion

// #region Mode instruction (aligned with Copilot's IChatRequestModeInstructions)

export interface IQuizModeInstruction {
	readonly uri?: URI;
	readonly name: string;
	readonly content: string;
	readonly toolReferences?: readonly IQuizInternalToolReference[];
	readonly metadata?: Record<string, boolean | string | number>;
	readonly isBuiltin?: boolean;
}

// #endregion

// #region Intent enumeration (aligned with Copilot's Intent const enum)

export const enum QuizIntent {
	Explain = 'quiz.explain',
	Review = 'quiz.review',
	Tests = 'quiz.tests',
	Fix = 'quiz.fix',
	New = 'quiz.new',
	NewNotebook = 'quiz.newNotebook',
	NotebookEditor = 'quiz.notebookEditor',
	InlineChat = 'quiz.inlineChat',
	Search = 'quiz.search',
	SemanticSearch = 'quiz.semanticSearch',
	Terminal = 'quiz.terminal',
	TerminalExplain = 'quiz.terminalExplain',
	Vscode = 'quiz.vscode',
	Unknown = 'quiz.unknown',
	SetupTests = 'quiz.setupTests',
	Editor = 'quiz.editor',
	Edit = 'quiz.edit',
	Agent = 'quiz.agent',
	Generate = 'quiz.generate',
	SearchPanel = 'quiz.searchPanel',
	SearchKeywords = 'quiz.searchKeywords',
	AskAgent = 'quiz.askAgent',
}

// #endregion

// #region IIntent (aligned with Copilot's IIntent from prompt/node/intents.ts)

export interface IQuizIntent {
	readonly id: string;
	readonly description: string;
	readonly locations: ChatAgentLocation[];
	readonly commandInfo?: IQuizIntentSlashCommandInfo;
	readonly isListedCapability?: boolean;
	invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation>;

	/**
	 * Handle a request directly. When defined, `invoke` isn't called anymore.
	 * Return the `QuizNullIntentInvocation` or throw an error.
	 */
	handleRequest?(
		conversation: IQuizConversation,
		request: IChatAgentRequest,
		stream: IQuizResponseStream,
		token: CancellationToken,
		documentContext: IQuizDocumentContext | undefined,
		agentName: string,
		location: ChatAgentLocation,
	): Promise<IQuizChatResult>;
}

// #endregion

// #region IIntentInvocationContext (aligned with Copilot's IIntentInvocationContext)

export interface IQuizIntentInvocationContext {
	readonly location: ChatAgentLocation;
	readonly request: IChatAgentRequest;
	readonly endpoint: IQuizIntentEndpoint;
	readonly documentContext?: IQuizDocumentContext;
	/** Slash command from the request, if any */
	readonly slashCommand?: { readonly name: string; readonly id: string };
}

// #endregion

// #region IIntentInvocation (aligned with Copilot's IIntentInvocation)

export interface IQuizIntentInvocation extends Partial<IQuizResponseProcessor> {
	readonly intent: IQuizIntent;
	readonly location: ChatAgentLocation;
	readonly endpoint: IQuizIntentEndpoint;
	/** The edit strategy for this invocation (auto, force insertion, force edit) */
	readonly editStrategy?: QuizEditStrategy;
	buildPrompt(context: IQuizBuildPromptContext, progress: IQuizBuildPromptProgress, token: CancellationToken): Promise<IQuizBuildPromptResult>;
	getAvailableTools?(): IQuizToolInfo[] | Promise<IQuizToolInfo[]> | undefined;
	confirmationHandler?(acceptedConfirmationData: unknown[] | undefined, rejectedConfirmationData: unknown[] | undefined, progress: IQuizResponseStream): Promise<void>;
	readonly linkification?: IQuizIntentLinkificationOptions;
	readonly codeblocksRepresentEdits?: boolean;
	modifyErrorDetails?(errorDetails: IQuizErrorDetails, response: IQuizChatResponse): IQuizErrorDetails;
	getAdditionalVariables?(context: IQuizBuildPromptContext): IQuizChatVariablesCollection | undefined;
}

// #endregion

// #region NullIntentInvocation (aligned with Copilot's NullIntentInvocation)

export class QuizNullIntentInvocation implements IQuizIntentInvocation {
	constructor(
		readonly intent: IQuizIntent,
		readonly location: ChatAgentLocation,
		readonly endpoint: IQuizIntentEndpoint,
	) { }

	async buildPrompt(): Promise<IQuizBuildPromptResult> {
		return { messages: [], tokenCount: 0 };
	}
}

// #endregion

// #region IResponseProcessor (aligned with Copilot's IResponseProcessor)

export interface IQuizResponseProcessorContext {
	readonly chatSessionId: string;
	readonly turn: IQuizTurn;
	readonly messages: readonly IQuizPromptMessage[];
	/** Record annotations that occurred when processing the LLM reply */
	addAnnotations?(annotations: IQuizOutcomeAnnotation[]): void;
	/** Store data in inline chat session storage. Only for inline chat. */
	storeInInlineSession?(store: IQuizSessionTurnStorage): void;
}

export interface IQuizResponseProcessor {
	processResponse(context: IQuizResponseProcessorContext, inputStream: AsyncIterable<IQuizResponsePart>, outputStream: IQuizResponseStream, token: CancellationToken): Promise<IQuizChatResult | void>;
}

// #endregion

// #region ReplyInterpreter (aligned with Copilot's ReplyInterpreter)

export interface IQuizReplyInterpreter {
	processResponse(context: IQuizResponseProcessorContext, inputStream: AsyncIterable<IQuizResponsePart>, outputStream: IQuizResponseStream, token: CancellationToken): Promise<void>;
}

export class QuizStreamingMarkdownReplyInterpreter implements IQuizReplyInterpreter {
	async processResponse(_context: IQuizResponseProcessorContext, inputStream: AsyncIterable<IQuizResponsePart>, outputStream: IQuizResponseStream, _token: CancellationToken): Promise<void> {
		for await (const part of inputStream) {
			outputStream.markdown(part.text);
		}
	}
}

/** A reply interpreter that does nothing with the response. */
export class QuizNoopReplyInterpreter implements IQuizReplyInterpreter {
	async processResponse(): Promise<void> {
		return undefined;
	}
}

// #endregion

// #region ResponsePart (aligned with Copilot's IResponsePart)

export interface IQuizResponsePart {
	readonly text: string;
	readonly toolCalls?: readonly IQuizToolCall[];
	readonly finishReason?: string;
}

// #endregion

// #region Endpoint (aligned with Copilot's IChatEndpoint)

export interface IQuizIntentEndpoint {
	readonly model: string;
	readonly family: string;
	readonly vendor: string;
	readonly supportsToolCalls: boolean;
	readonly maxOutputTokens: number;
	readonly maxInputTokens: number;
	readonly name: string;
	readonly identityName: string;
}

// #endregion

// #region DocumentContext (aligned with Copilot's IDocumentContext)

export interface IQuizDocumentContext {
	readonly documentUri: URI;
	readonly selection: IQuizRange;
	readonly wholeRange?: IQuizRange;
	readonly languageId?: string;
}

// #endregion

// #region Build prompt types (aligned with Copilot's IBuildPromptContext/IBuildPromptResult)

export interface IQuizBuildPromptContext {
	readonly requestId?: string;
	readonly query: string;
	readonly history: readonly IQuizTurn[];
	readonly request?: IChatAgentRequest;
	readonly chatVariables?: IQuizChatVariablesCollection;
	/** The working set of files being edited */
	readonly workingSet?: IQuizWorkingSet;
	/** Tool-related context for the current request */
	readonly tools?: IQuizBuildPromptToolsContext;
	/** Mode instructions from the chat request */
	readonly modeInstructions?: string;
	readonly toolCallRounds?: readonly IQuizToolCallRound[];
	readonly toolCallResults?: Record<string, IQuizToolResult>;
	/** Tool grouping configuration for virtual tools */
	readonly toolGrouping?: IQuizToolGrouping;
	/**
	 * Map of documents that have been edited during the current turn.
	 * Used by edit tools to avoid race conditions with parallel edits.
	 * The map is created anew each turn.
	 */
	turnEditedDocuments?: ResourceMap<QuizTextDocumentSnapshot | QuizNotebookDocumentSnapshot>;
	/** URIs that are explicitly allowed for editing without user confirmation */
	readonly allowedEditUris?: ResourceSet;
	/** File edit events from the request */
	readonly editedFileEvents?: readonly IQuizEditedFileEvent[];
	readonly conversation?: IQuizConversation;
	/** The response stream for the current request */
	readonly stream?: IQuizResponseStream;
	readonly isContinuation?: boolean;
	/** True when the query contains a stop hook message */
	readonly hasStopHookQuery?: boolean;
	/** Additional context provided by a hook */
	readonly additionalHookContext?: string;
	/** The headerRequestId from the most recent parent fetch response (for subagent telemetry) */
	readonly parentHeaderRequestId?: string;
	/** The modelCallId from the most recent parent model call (for subagent telemetry) */
	readonly parentModelCallId?: string;
}

export interface IQuizBuildPromptProgress {
	report(message: string | IQuizProgressPart): void;
}

export interface IQuizProgressPart {
	readonly kind: 'reference' | 'progress';
}

export interface IQuizBuildPromptResult {
	readonly messages: IQuizPromptMessage[];
	readonly toolDefinitions?: IQuizToolDefinition[];
	readonly tokenCount?: number;
	readonly references?: readonly IQuizPromptReference[];
}

// #endregion

// #region ChatVariables (aligned with Copilot's ChatVariablesCollection - simplified)

export interface IQuizChatVariablesCollection {
	readonly references: readonly IQuizPromptReference[];
	add(reference: IQuizPromptReference): void;
	readonly size: number;
}

export class QuizChatVariablesCollection implements IQuizChatVariablesCollection {
	private readonly _references: IQuizPromptReference[] = [];

	constructor(initial?: readonly IQuizPromptReference[]) {
		if (initial) {
			this._references.push(...initial);
		}
	}

	get references(): readonly IQuizPromptReference[] { return this._references; }
	get size(): number { return this._references.length; }
	add(reference: IQuizPromptReference): void { this._references.push(reference); }
}

export interface IQuizPromptReference {
	readonly id: string;
	readonly name: string;
	readonly value: URI | IQuizLocation | unknown;
	readonly range?: [start: number, end: number];
}

// #endregion

// #region Tool types (aligned with Copilot's InternalToolReference + tool types)

export interface IQuizToolInfo {
	readonly name: string;
	readonly description: string;
	readonly inputSchema?: object;
	readonly tags?: readonly string[];
}

export interface IQuizToolDefinition {
	readonly name: string;
	readonly description: string;
	readonly inputSchema?: object;
}

export interface IQuizToolResult {
	readonly text?: string;
	readonly error?: boolean;
}

// #endregion

// #region Prompt message (aligned with Copilot's Raw.ChatMessage)

export const enum QuizPromptMessageRole {
	System = 'system',
	User = 'user',
	Assistant = 'assistant',
	Tool = 'tool',
}

export interface IQuizPromptMessage {
	readonly role: QuizPromptMessageRole;
	readonly content: string;
	readonly toolCallId?: string;
	readonly toolName?: string;
	readonly toolCalls?: readonly IQuizToolCall[];
}

// #endregion

// #region Conversation/Turn (aligned with Copilot's Conversation/Turn)

export interface IQuizTurn {
	readonly id: string;
	readonly request: IQuizTurnRequest;
	response?: IQuizTurnResponse;
	readonly toolCallRounds: IQuizToolCallRound[];
	setResponse(status: QuizTurnStatus, message: IQuizTurnResponseMessage, responseId?: string, toolCallRounds?: IQuizToolCallRound[], result?: IQuizChatResult): void;
	/** Type-safe metadata: get metadata by class key (aligned with Copilot's Turn.getMetadata) */
	getMetadata<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T | undefined;
	/** Type-safe metadata: get all metadata entries by class key */
	getAllMetadata<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T[] | undefined;
	/** Type-safe metadata: set metadata using class constructor as key */
	setMetadata<T extends QuizPromptMetadata>(value: T): void;
	readonly startTime: number;
	/** Pending summaries applied during the tool-call loop, before setResponse is called */
	addPendingSummary(toolCallRoundId: string, text: string): void;
	readonly pendingSummaries: readonly { toolCallRoundId: string; text: string }[];

	// --- Additional getters aligned with Copilot's Turn

	/** Chat variables / prompt references attached to this turn */
	readonly promptVariables: IQuizChatVariablesCollection | undefined;
	/** Tool references explicitly requested by the user */
	readonly toolReferences: readonly IQuizInternalToolReference[];
	/** Prompt references accumulated during the turn (from prompt building) */
	readonly references: readonly IQuizPromptReference[];
	/** Add prompt references, deduplicating overlaps (aligned with Copilot's Turn.addReferences) */
	addReferences(newReferences: readonly IQuizPromptReference[]): void;
	/** File edit events that occurred during the request */
	readonly editedFileEvents?: IQuizEditedFileEvent[];
	/** Whether this is a continuation of a previous request */
	readonly isContinuation: boolean;
	/** Mode-specific instructions for the current chat mode */
	readonly modeInstructions?: readonly IQuizModeInstruction[];

	// --- Response getters aligned with Copilot's Turn

	/** The response message */
	readonly responseMessage: IQuizTurnResponseMessage | undefined;
	/** The response status */
	readonly responseStatus: QuizTurnStatus;
	/** The response ID from the model */
	readonly responseId: string | undefined;
	/** The chat result */
	readonly responseChatResult: IQuizChatResult | undefined;
	/** Result metadata shortcut */
	readonly resultMetadata: Partial<IQuizResultMetadata> | undefined;
	/** The rendered user message from result metadata */
	readonly renderedUserMessage: unknown | undefined;
	/** Tool call rounds, with fallback to a synthetic round if none exist (aligned with Copilot's Turn.rounds) */
	readonly rounds: readonly IQuizToolCallRound[];
}

export interface IQuizTurnRequest {
	readonly message: string;
	readonly type: 'user' | 'follow-up' | 'template' | 'offtopic-detection' | 'model' | 'meta' | 'server';
	/** Chat variables / prompt references attached to this request */
	readonly promptVariables?: IQuizChatVariablesCollection;
	/** Tool references explicitly requested by the user */
	readonly toolReferences?: readonly IQuizInternalToolReference[];
	/** File edit events that occurred during the request */
	readonly editedFileEvents?: IQuizEditedFileEvent[];
	/** Confirmation data accepted by the user */
	readonly acceptedConfirmationData?: unknown[];
	/** Whether this is a continuation of a previous request (e.g., tool call limit acceptance, continue-on-error, auto-on-rate-limit) */
	readonly isContinuation: boolean;
	/** Mode-specific instructions for the current chat mode */
	readonly modeInstructions?: readonly IQuizModeInstruction[];
}

export type IQuizTurnResponseMessage =
	| { readonly type: 'model'; readonly message: string }
	| { readonly type: 'user'; readonly message: string };

export interface IQuizTurnResponse {
	readonly message: IQuizTurnResponseMessage;
	readonly status: QuizTurnStatus;
	readonly responseId: string | undefined;
	readonly result?: IQuizChatResult;
}

export const enum QuizTurnStatus {
	InProgress = 'in-progress',
	Success = 'success',
	Cancelled = 'cancelled',
	OffTopic = 'off-topic',
	Filtered = 'filtered',
	PromptFiltered = 'prompt-filtered',
	Error = 'error',
}

export interface IQuizConversation {
	readonly sessionId: string;
	readonly turns: readonly IQuizTurn[];
	getLatestTurn(): IQuizTurn | undefined;
	addTurn(turn: IQuizTurn): void;
	/** Get the total token usage across all turns (aligned with Copilot's Conversation token tracking) */
	getTokenUsage?(): IQuizConversationTokenUsage;
	/** Get the conversation start time */
	readonly startTime?: number;
}

// #endregion

// #region Tool call round (aligned with Copilot's IToolCallRound)

export interface IQuizToolCallRound {
	id: string;
	summary?: string;
	response: string;
	toolInputRetry: number;
	toolCalls: IQuizToolCall[];
	/** Thinking/reasoning data from the model */
	thinking?: IQuizThinkingData;
	/** Stateful marker used with the Responses API */
	statefulMarker?: string;
	/** Compaction data from the Responses API, round-tripped in outgoing requests */
	compaction?: IQuizContextManagementResponse;
	/** Token usage for this round (aligned with Copilot's IToolCallRound.usage) */
	usage?: IQuizRoundTokenUsage;
	timestamp?: number;
	hookContext?: string;
	phase?: string;
	modelId?: string;
}

/**
 * Token usage for a single tool call round.
 * Aligned with Copilot's per-round usage tracking.
 */
export interface IQuizRoundTokenUsage {
	readonly promptTokens: number;
	readonly completionTokens: number;
	readonly cachedTokens?: number;
}

/**
 * Aggregate token usage across a conversation.
 * Aligned with Copilot's Conversation token tracking.
 */
export interface IQuizConversationTokenUsage {
	readonly totalPromptTokens: number;
	readonly totalCompletionTokens: number;
	readonly totalCachedTokens: number;
}

export interface IQuizToolCall {
	name: string;
	arguments: string;
	id: string;
}

// #endregion

// #region Response stream (aligned with vscode.ChatResponseStream)

export interface IQuizResponseStream {
	markdown(value: string): void;
	progress(message: string): void;
	warning(message: string): void;
	toolInvocation?(toolId: string, name: string, args: object): IQuizToolInvocationStream;
}

export interface IQuizToolInvocationStream {
	progress(message: string): void;
	result(result: IQuizToolResult): void;
}

// #endregion

// #region Error details (aligned with vscode.ChatErrorDetails)

export interface IQuizErrorDetails {
	message: string;
	responseIsIncomplete?: boolean;
	responseIsFiltered?: boolean;
}

// #endregion

// #region Chat result (aligned with vscode.ChatResult)

export interface IQuizChatResult {
	readonly errorDetails?: IQuizErrorDetails;
	readonly metadata?: Partial<IQuizResultMetadata>;
}

// #endregion

// #region Result metadata (aligned with Copilot's IResultMetadata)

/**
 * Detailed metadata for a chat result, including model info, token usage,
 * code blocks, tool call rounds, summaries, and more.
 */
export interface IQuizResultMetadata {
	modelMessageId: string;
	responseId: string;
	sessionId: string;
	agentId: string;
	/** The user message exactly as it must be rendered in history */
	renderedUserMessage?: unknown;
	/** The rendered global context message parts for prompt caching */
	renderedGlobalContext?: unknown[];
	/** Cache key for global context invalidation */
	globalContextCacheKey?: string;
	command?: string;
	filterCategory?: string;
	/** All code blocks that were in the response */
	codeBlocks?: readonly IQuizCodeBlock[];
	toolCallRounds?: readonly IQuizToolCallRound[];
	toolCallResults?: Record<string, IQuizToolResult>;
	maxToolCallsExceeded?: boolean;
	/** @deprecated Use summaries instead */
	summary?: IQuizSummaryEntry;
	summaries?: readonly IQuizSummaryEntry[];
	resolvedModel?: string;
	promptTokens?: number;
	outputTokens?: number;
	shouldAutoSwitchToAuto?: boolean;
	/** The full text of the response, for debugging and testing */
	fullResponseText?: string;
	/** Whether the request was cancelled */
	cancelled?: boolean;
	/** Whether the max tool call rounds was reached */
	maxRoundsReached?: boolean;
}

export interface IQuizCodeBlock {
	readonly code: string;
	readonly language?: string;
	readonly resource?: URI;
	readonly markdownBeforeBlock?: string;
}

export interface IQuizSummaryEntry {
	toolCallRoundId: string;
	text: string;
	source?: 'foreground' | 'background';
	outcome?: string;
	model?: string;
	summarizationMode?: string;
	durationMs?: number;
	contextLengthBefore?: number;
	numRounds?: number;
	numRoundsSinceLastSummarization?: number;
	usage?: { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } };
}

// #endregion

// #region Chat response (aligned with Copilot's ChatResponse)

export interface IQuizChatResponse {
	readonly message: string;
	readonly finishReason?: string;
}

// #endregion

// #region Linkification (aligned with Copilot's IntentLinkificationOptions)

export interface IQuizIntentLinkificationOptions {
	readonly disable?: boolean;
	readonly additionalLinkifiers?: readonly IQuizContributedLinkifierFactory[];
}

export interface IQuizContributedLinkifierFactory {
	create(): IQuizContributedLinkifier;
}

export interface IQuizContributedLinkifier {
	linkify(text: string, context: IQuizLinkifierContext, token?: CancellationToken): Promise<IQuizLinkifiedText | undefined>;
}

export interface IQuizLinkifierContext {
	readonly sessionId: string;
}

export interface IQuizLinkifiedText {
	readonly parts: readonly IQuizLinkifiedPart[];
}

export type IQuizLinkifiedPart = string | IQuizLinkifyAnchor;

export interface IQuizLinkifyAnchor {
	readonly uri: URI;
	readonly range?: IQuizRange;
	readonly label: string;
}

// #endregion

// #region Slash command info (aligned with Copilot's IIntentSlashCommandInfo)

export interface IQuizIntentSlashCommandInfo {
	readonly hiddenFromUser?: boolean;
	readonly allowsEmptyArgs?: boolean;
	readonly defaultEnablement?: boolean;
	readonly sampleRequest?: string;
	/** The tool that is equivalent to this slash command */
	readonly toolEquivalent?: string;
}

// #endregion

// #region Edit strategy (aligned with Copilot's EditStrategy)

export const enum QuizEditStrategy {
	Auto = 'auto',
	ForceInsertion = 'forceInsertion',
	ForceEdit = 'forceEdit',
}

// #endregion

// #region Intent service (aligned with Copilot's IIntentService)

export const IQuizIntentService = createDecorator<IQuizIntentService>('quizIntentService');

export interface IQuizIntentService {
	_serviceBrand: undefined;
	readonly onDidChangeIntents: Event<void>;
	registerIntent(intent: IQuizIntent): IDisposable;
	getIntent(id: string, location?: ChatAgentLocation): IQuizIntent | undefined;
	getIntents(location?: ChatAgentLocation): IQuizIntent[];
}

// #endregion

// #region Build prompt tools context (aligned with Copilot's IBuildPromptContext.tools)

/**
 * Tool-related context for building a prompt.
 */
export interface IQuizBuildPromptToolsContext {
	/** Tool references from the request (explicitly invoked tools) */
	readonly toolReferences: readonly IQuizInternalToolReference[];
	/** Token for authorizing tool invocations */
	readonly toolInvocationToken: unknown;
	/** All available tools for this request */
	readonly availableTools: readonly IQuizToolInfo[];
	/** Subagent invocation ID, if this is a subagent request */
	readonly subAgentInvocationId?: string;
	/** Subagent name, if this is a subagent request */
	readonly subAgentName?: string;
}

// #endregion

// #region IntentError (aligned with Copilot's IntentError)

/**
 * An error type that can be thrown from IQuizIntent.invoke to signal
 * an ordinary error to the user.
 */
export class QuizIntentError extends Error {
	public readonly errorDetails: IQuizErrorDetails;

	constructor(
		error: string | IQuizErrorDetails,
	) {
		super(typeof error === 'string' ? error : error.message);
		this.errorDetails = typeof error === 'string' ? { message: error } : error;
	}
}

// #endregion

// #region OutcomeAnnotation (aligned with Copilot's OutcomeAnnotation)

/**
 * Annotation recorded during response processing to capture outcomes
 * like edits applied, files changed, etc.
 */
export interface IQuizOutcomeAnnotation {
	readonly type: string;
	readonly data: unknown;
}

// #endregion

// #region SessionTurnStorage (aligned with Copilot's ISessionTurnStorage)

/**
 * Storage for inline chat session data that persists across turns.
 */
export interface IQuizSessionTurnStorage {
	readonly lastDocumentContent?: string;
	readonly lastWholeRange?: IQuizRange;
	[key: string]: unknown;
}

// #endregion

// #endregion
