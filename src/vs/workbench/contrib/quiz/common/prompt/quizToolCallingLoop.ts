/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's extension/intents/node/toolCallingLoop.ts
// Layer: common — contains only pure-logic types, interfaces, enums, and helper functions.
// Implementation (QuizDefaultToolCallingLoop) moved to browser/prompt/quizToolCallingLoopImpl.ts
// to comply with the four-layer architecture (common/ must not contain DI-injected classes).

import {
	IQuizChatResult,
	IQuizPromptMessage,
	IQuizResponseStream,
	IQuizToolCallRound,
	IQuizToolInfo,
	IQuizToolResult,
	IQuizResponseProcessor,
} from '../intents/quizIntents.js';
import { IQuizEndpoint, IQuizTokenUsage } from '../endpoint/quizEndpoint.js';
import { QuizConversation } from './quizConversation.js';
import { IQuizChatRequestHooks } from './quizHookService.js';

// #region Tool call limit behavior (aligned with Copilot's ToolCallLimitBehavior)

export const enum QuizToolCallLimitBehavior {
	Confirm = 0,
	Stop = 1,
}

// #endregion

// #region Permission level (aligned with Copilot's ChatRequest.permissionLevel)

export type QuizPermissionLevel = 'normal' | 'autoApprove' | 'autopilot';

// #endregion

// #region Response type (aligned with Copilot's ChatFetchResponseType)

export const enum QuizFetchResponseType {
	Success = 0,
	Canceled = 1,
	RateLimited = 2,
	QuotaExceeded = 3,
	Error = 4,
	OffTopic = 5,
}

// #endregion

// #region Tool calling loop options (aligned with Copilot's IToolCallingLoopOptions)

export interface IQuizToolCallingLoopOptions {
	readonly conversation: QuizConversation;
	/** Maximum number of tool call iterations before stopping */
	toolCallLimit: number;
	/**
	 * What to do when the limit is hit. Defaults to QuizToolCallLimitBehavior.Stop.
	 * If set to Confirm, a confirmation prompt is shown to the user.
	 */
	onHitToolCallLimit?: QuizToolCallLimitBehavior;
	/**
	 * "mixins" that can be used to wrap the response stream.
	 * Aligned with Copilot's ResponseStreamParticipant[].
	 */
	streamParticipants?: IQuizStreamParticipant[];
	/**
	 * Optional custom response processor.
	 */
	responseProcessor?: IQuizResponseProcessor;
	/**
	 * A getter that returns true if VS Code has requested the extension to
	 * gracefully yield. When set, it's likely that the editor will immediately
	 * follow up with a new request in the same conversation.
	 */
	yieldRequested?: () => boolean;
	/** The endpoint for model requests */
	readonly endpoint: IQuizEndpoint;
	/** The chat session ID */
	readonly chatSessionId: string;
	/** The request ID */
	readonly requestId: string;
	/** Permission level for the request (affects autopilot/auto-retry behavior) */
	readonly permissionLevel?: QuizPermissionLevel;
	/** Hooks configured for this request */
	readonly hooks?: IQuizChatRequestHooks;
	/** Whether hooks are enabled for this request */
	readonly hasHooksEnable?: boolean;
	/** Subagent invocation ID, if this is a subagent request */
	readonly subAgentInvocationId?: string;
	/** Subagent name, if this is a subagent request */
	readonly subAgentName?: string;
}

// #endregion

// #region Stream participant (aligned with Copilot's ResponseStreamParticipant)

/**
 * A function that wraps a response stream to add behavior.
 * Aligned with Copilot's ResponseStreamParticipant.
 */
export type IQuizStreamParticipant = (inner: IQuizResponseStream) => IQuizResponseStream;

// #endregion

// #region Hook result types (aligned with Copilot's StartHookResult/StopHookResult/SubagentStartHookResult/SubagentStopHookResult)

export interface IQuizStartHookResult {
	readonly additionalContext?: string;
}

export interface IQuizStopHookResult {
	readonly shouldContinue: boolean;
	readonly reasons?: readonly string[];
}

export interface IQuizSubagentStartHookResult {
	readonly additionalContext?: string;
}

export interface IQuizSubagentStopHookResult {
	readonly shouldContinue: boolean;
	readonly reasons?: readonly string[];
}

// #endregion

// #region Result types (aligned with Copilot's IToolCallSingleResult/IToolCallLoopResult)

export interface IQuizToolCallSingleResult {
	response: IQuizFetchResult;
	round: IQuizToolCallRound;
	chatResult?: IQuizChatResult;
	hadIgnoredFiles: boolean;
	lastRequestMessages: IQuizPromptMessage[];
	availableTools: readonly IQuizToolInfo[];
}

export interface IQuizToolCallLoopResult extends IQuizToolCallSingleResult {
	toolCallRounds: IQuizToolCallRound[];
	toolCallResults: Record<string, IQuizToolResult>;
}

export interface IQuizFetchResult {
	readonly type: QuizFetchResponseType;
	readonly value: string;
	readonly usage?: IQuizTokenUsage;
	readonly resolvedModel?: string;
}

// #endregion

// #region Empty prompt error (aligned with Copilot's EmptyPromptError)

export class QuizEmptyPromptError extends Error {
	constructor() {
		super('Empty prompt');
	}
}

// #endregion

// #region Hook context formatting (aligned with Copilot's formatHookContext)

/**
 * Formats a hook context message from blocking reasons.
 * Aligned with Copilot's formatHookContext.
 */
export function formatQuizHookContext(reasons: readonly string[]): string {
	if (reasons.length === 1) {
		return `You were about to complete but a hook blocked you with the following message: "${reasons[0]}". Please address this requirement before completing.`;
	}
	const formattedReasons = reasons.map((reason, i) => `${i + 1}. ${reason}`).join('\n');
	return `You were about to complete but multiple hooks blocked you with the following messages:\n${formattedReasons}\n\nPlease address all of these requirements before completing.`;
}

// #endregion

// ToolCallingLoop implementation moved to browser/prompt/quizToolCallingLoopImpl.ts
// to comply with the four-layer architecture (common/ must not contain DI-injected classes).
// The implementation class QuizDefaultToolCallingLoop uses @ILogService, @IQuizChatHookService,
// @IQuizSessionTranscriptService DI injections which require the browser layer.
