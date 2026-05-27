/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's extension/intents/node/toolCallingLoop.ts
// Core tool calling loop with hooks, autopilot, auto-retry, yield, tool call limit,
// stream participants, internal tool call IDs, and message post-processing.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	IQuizBuildPromptContext,
	IQuizChatResult,
	IQuizIntentInvocation,
	IQuizPromptMessage,
	IQuizResponsePart,
	IQuizResponseProcessor,
	IQuizResponseProcessorContext,
	IQuizResponseStream,
	IQuizToolCall,
	IQuizToolCallRound,
	IQuizToolInfo,
	IQuizToolResult,
	IQuizThinkingData,
	QuizPromptMessageRole,
	QuizTurnStatus,
} from '../intents/quizIntents.js';
import { IQuizEndpoint, IQuizChatRequestOptions, IQuizTokenUsage } from '../endpoint/quizEndpoint.js';
import { IQuizToolsService, IQuizToolInvocationContext } from '../tools/quizToolsService.js';
import { QuizConversation, QuizToolCallRoundImpl } from './quizConversation.js';
import {
	IQuizChatHookService,
	IQuizChatRequestHooks,
	IQuizHookOutputStream,
	IQuizSessionStartHookInput,
	IQuizSessionStartHookOutput,
	IQuizStopHookInput,
	IQuizStopHookOutput,
	IQuizSubagentStartHookInput,
	IQuizSubagentStartHookOutput,
	IQuizSubagentStopHookInput,
	IQuizSubagentStopHookOutput,
	isQuizHookAbortError,
	processQuizHookResults,
} from './quizHookService.js';
import { IQuizSessionTranscriptService } from './quizSessionTranscript.js';

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
	readonly hasHooksEnabled?: boolean;
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

interface IQuizStartHookResult {
	readonly additionalContext?: string;
}

interface IQuizStopHookResult {
	readonly shouldContinue: boolean;
	readonly reasons?: readonly string[];
}

interface IQuizSubagentStartHookResult {
	readonly additionalContext?: string;
}

interface IQuizSubagentStopHookResult {
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
function formatQuizHookContext(reasons: readonly string[]): string {
	if (reasons.length === 1) {
		return `You were about to complete but a hook blocked you with the following message: "${reasons[0]}". Please address this requirement before completing.`;
	}
	const formattedReasons = reasons.map((reason, i) => `${i + 1}. ${reason}`).join('\n');
	return `You were about to complete but multiple hooks blocked you with the following messages:\n${formattedReasons}\n\nPlease address all of these requirements before completing.`;
}

// #endregion

// #region ToolCallingLoop (aligned with Copilot's ToolCallingLoop)

/**
 * Core tool calling loop that:
 * 1. Builds prompt via IQuizIntentInvocation
 * 2. Sends to model via IQuizEndpoint
 * 3. Checks for tool calls in response
 * 4. Executes tools via IQuizToolsService and appends results
 * 5. Loops until no tool calls or tool call limit reached
 *
 * Enhanced with hooks, autopilot, auto-retry, yield behavior,
 * tool call limit handling, stream participants, internal tool call IDs,
 * and message post-processing — aligned with Copilot's ToolCallingLoop.
 */
export class QuizDefaultToolCallingLoop extends Disposable {

	private static NextToolCallId = Date.now();
	private static readonly TASK_COMPLETE_TOOL_NAME = 'task_complete';
	private static readonly MAX_AUTOPILOT_RETRIES = 3;
	private static readonly MAX_AUTOPILOT_ITERATIONS = 5;

	private toolCallResults: Record<string, IQuizToolResult> = Object.create(null);
	private _toolCallRounds: IQuizToolCallRound[] = [];
	private additionalHookContext: string | undefined;

	// Autopilot state
	private autopilotRetryCount = 0;
	private autopilotIterationCount = 0;
	private taskCompleted = false;
	private autopilotStopHookActive = false;
	private autopilotProgressDeferred: { complete(value: undefined): void } | undefined;

	constructor(
		private readonly _invocation: IQuizIntentInvocation,
		private readonly _options: IQuizToolCallingLoopOptions,
		private readonly _toolsService: IQuizToolsService,
		@ILogService private readonly _logService: ILogService,
		@IQuizChatHookService private readonly _hookService: IQuizChatHookService,
		@IQuizSessionTranscriptService private readonly _transcriptService: IQuizSessionTranscriptService,
	) {
		super();
	}

	get currentToolCallRounds(): readonly IQuizToolCallRound[] {
		return this._toolCallRounds;
	}

	private get turn() {
		return this._options.conversation.getLatestTurn();
	}

	/**
	 * Append additional hook context to be included in the next prompt.
	 * Aligned with Copilot's ToolCallingLoop.appendAdditionalHookContext.
	 */
	public appendAdditionalHookContext(context: string): void {
		if (!context) {
			return;
		}
		this.additionalHookContext = this.additionalHookContext
			? `${this.additionalHookContext}\n${context}`
			: context;
	}

	// #region Start hooks (aligned with Copilot's runStartHooks)

	/**
	 * Executes start hooks (SessionStart for regular sessions, SubagentStart for subagents).
	 * Should be called before run() to allow hooks to provide context before the first prompt.
	 *
	 * Aligned with Copilot's ToolCallingLoop.runStartHooks.
	 * @throws QuizHookAbortError if a hook requests the session/subagent to abort
	 */
	public async runStartHooks(outputStream: IQuizResponseStream | undefined, token: CancellationToken): Promise<void> {
		const sessionId = this._options.conversation.sessionId;
		const hasHooks = this._options.hasHooksEnabled;

		// Report which hooks are configured for this request
		this._hookService.logConfiguredHooks(this._options.hooks);

		// Execute SubagentStart hook for subagent requests, or SessionStart hook for first turn of regular sessions
		if (this._options.subAgentInvocationId) {
			const startHookResult = await this.executeSubagentStartHook({
				agent_id: this._options.subAgentInvocationId,
				agent_type: this._options.subAgentName ?? 'default',
			}, sessionId, outputStream, token);
			if (startHookResult.additionalContext) {
				this.additionalHookContext = startHookResult.additionalContext;
				this._logService.info(`[QuizToolCallingLoop] SubagentStart hook provided context for subagent ${this._options.subAgentInvocationId}`);
			}
		} else {
			const isFirstTurn = this._options.conversation.turns.length === 1;

			if (hasHooks) {
				// Start the transcript (will replay history if no file exists yet)
				await this._transcriptService.startSession(sessionId);
			}

			if (isFirstTurn) {
				const startHookResult = await this.executeSessionStartHook({
					source: 'new',
					model: this._options.endpoint.modelId ?? 'unknown',
				}, sessionId, outputStream, token);
				if (startHookResult.additionalContext) {
					this.additionalHookContext = startHookResult.additionalContext;
					this._logService.info('[QuizToolCallingLoop] SessionStart hook provided context for session');
				}
			}
		}

		// Log the user message for the transcript (no-ops if session was not started)
		this._transcriptService.logUserMessage(
			sessionId,
			this.turn?.request.message ?? '',
		);
	}

	// #endregion

	// #region Main run loop (aligned with Copilot's run + _runLoop)

	/**
	 * Entry point for the tool calling loop.
	 * Aligned with Copilot's ToolCallingLoop.run.
	 */
	async run(
		context: IQuizBuildPromptContext,
		progress: (message: string) => void,
		token: CancellationToken,
	): Promise<IQuizChatResult> {
		const conversation = this._options.conversation;
		const turn = conversation.getLatestTurn();

		// Merge additional variables from invocation
		const additionalVars = this._invocation.getAdditionalVariables?.(context);
		const effectiveContext = additionalVars ? { ...context, chatVariables: additionalVars } : context;

		let i = 0;
		let lastResult: IQuizToolCallSingleResult | undefined;
		let stopHookActive = false;
		const sessionId = conversation.sessionId;

		while (true) {
			// Check tool call limit
			if (lastResult && i++ >= this._options.toolCallLimit) {
				// In Autopilot mode, silently increase the limit and continue
				// without showing the confirmation dialog, up to a hard cap.
				const permLevel = this._options.permissionLevel;
				if (permLevel === 'autopilot' && this._options.toolCallLimit < 200) {
					this._options.toolCallLimit = Math.min(Math.round(this._options.toolCallLimit * 3 / 2), 200);
					this.showAutopilotProgress(outputStreamFromProgress(progress), 'Autopilot: extending tool call limit\u2026', 'Autopilot extended tool call limit');
				} else {
					lastResult = this.hitToolCallLimit(outputStreamFromProgress(progress), lastResult);
					break;
				}
			}

			// Check if VS Code has requested we gracefully yield before starting the next iteration.
			// In autopilot mode, don't yield until the task is actually complete.
			if (lastResult && this._options.yieldRequested?.()) {
				if (this._options.permissionLevel !== 'autopilot' || this.taskCompleted) {
					break;
				}
			}

			try {
				const turnId = String(i);
				this._transcriptService.logAssistantTurnStart(sessionId, turnId);
				this.resolveAutopilotProgress();

				// Build prompt
				if (token.isCancellationRequested) {
					turn?.setResponse(QuizTurnStatus.Cancelled, { type: 'model', message: '' }, undefined, this._toolCallRounds);
					return { metadata: { toolCallRounds: this._toolCallRounds, cancelled: true } };
				}

				this._logService.debug(`[QuizToolCallingLoop] round ${i}/${this._options.toolCallLimit}`);

				const promptResult = await this._invocation.buildPrompt(
					effectiveContext,
					{ report: (msg: string) => progress(msg) },
					token,
				);

				if (token.isCancellationRequested) {
					turn?.setResponse(QuizTurnStatus.Cancelled, { type: 'model', message: '' }, undefined, this._toolCallRounds);
					return { metadata: { toolCallRounds: this._toolCallRounds, cancelled: true } };
				}

				// Apply message post-processing (strip internal IDs, validate tool messages)
				const processedMessages = this.applyMessagePostProcessing(promptResult.messages);

				// Send to model
				const modelResponse = await this._sendModelRequest(processedMessages, i, token);

				if (token.isCancellationRequested) {
					turn?.setResponse(QuizTurnStatus.Cancelled, { type: 'model', message: '' }, undefined, this._toolCallRounds);
					return { metadata: { toolCallRounds: this._toolCallRounds, cancelled: true } };
				}

				// Create internal tool call IDs to avoid reuse conflicts
				const toolCalls = (modelResponse.toolCalls ?? []).map(tc => ({
					...tc,
					id: this.createInternalToolCallId(tc.id),
					arguments: tc.arguments === '' ? '{}' : tc.arguments,
				}));

				// Create round record
				const roundId = generateUuid();
				const toolCallRound: IQuizToolCallRound = new QuizToolCallRoundImpl(
					roundId,
					modelResponse.text,
					toolCalls,
					0, // toolInputRetry
					undefined, // summary
					Date.now(),
					undefined, // hookContext
					undefined, // phase
					this._options.endpoint.modelId,
					modelResponse.thinking,
					modelResponse.statefulMarker,
					undefined, // compaction
					modelResponse.usage ? { promptTokens: modelResponse.usage.promptTokens, completionTokens: modelResponse.usage.completionTokens, cachedTokens: modelResponse.usage.cachedTokens } : undefined,
				);

				const fetchResult: IQuizFetchResult = {
					type: modelResponse.finishReason === 'error' ? QuizFetchResponseType.Error
						: modelResponse.finishReason === 'cancel' ? QuizFetchResponseType.Canceled
							: QuizFetchResponseType.Success,
					value: modelResponse.text,
					usage: modelResponse.usage,
				};

				lastResult = {
					response: fetchResult,
					round: toolCallRound,
					hadIgnoredFiles: false,
					lastRequestMessages: processedMessages,
					availableTools: [],
				};

				this._toolCallRounds.push(toolCallRound);
				turn?.addToolCallRound(toolCallRound);
				this._transcriptService.logAssistantTurnEnd(sessionId, turnId);

				// If the model produced productive (non-task_complete) tool calls after being nudged,
				// reset the stop hook flag and iteration count so it can be nudged again.
				if (this.autopilotStopHookActive && toolCalls.length && !toolCalls.some(tc => tc.name === QuizDefaultToolCallingLoop.TASK_COMPLETE_TOOL_NAME)) {
					this.autopilotStopHookActive = false;
					this.autopilotIterationCount = 0;
				}

				if (!toolCalls.length || fetchResult.type !== QuizFetchResponseType.Success) {
					// If cancelled, don't run stop hooks - just break immediately
					if (token.isCancellationRequested) {
						break;
					}

					// In auto-approve modes, auto-retry on transient errors (not rate-limited or quota-exceeded)
					if (fetchResult.type !== QuizFetchResponseType.Success && this.shouldAutoRetry(fetchResult)) {
						this.autopilotRetryCount++;
						this._logService.info(`[QuizToolCallingLoop] Auto-retrying on error (attempt ${this.autopilotRetryCount}/${QuizDefaultToolCallingLoop.MAX_AUTOPILOT_RETRIES}): ${fetchResult.type}`);
						this.showAutopilotProgress(
							outputStreamFromProgress(progress),
							this._options.permissionLevel === 'autopilot' ? 'Autopilot: recovering from a request error\u2026' : 'Recovering from a request error\u2026',
							this._options.permissionLevel === 'autopilot' ? 'Autopilot recovered from a request error' : 'Recovered from a request error',
						);
						await new Promise<void>(resolve => setTimeout(resolve, 1000));
						continue;
					}

					// Before stopping, execute the stop hook
					const os = outputStreamFromProgress(progress);
					if (this._options.subAgentInvocationId) {
						const stopHookResult = await this.executeSubagentStopHook({
							agent_id: this._options.subAgentInvocationId,
							agent_type: this._options.subAgentName ?? 'default',
							stop_hook_active: stopHookActive,
						}, sessionId, os, token);
						const joinedReasons = stopHookResult.reasons?.join('; ');
						this._logService.info(`[QuizToolCallingLoop] Subagent stop hook result: shouldContinue=${stopHookResult.shouldContinue}, reasons=${joinedReasons}`);
						if (stopHookResult.shouldContinue && stopHookResult.reasons?.length) {
							this.showSubagentStopHookBlockedMessage(os, stopHookResult.reasons);
							toolCallRound.hookContext = formatQuizHookContext(stopHookResult.reasons);
							this._logService.info(`[QuizToolCallingLoop] Subagent stop hook blocked, continuing with reasons: ${joinedReasons}`);
							stopHookActive = true;
							continue;
						}
					} else {
						const stopHookResult = await this.executeStopHook({ stop_hook_active: stopHookActive }, sessionId, os, token);
						const joinedReasons = stopHookResult.reasons?.join('; ');
						this._logService.info(`[QuizToolCallingLoop] Stop hook result: shouldContinue=${stopHookResult.shouldContinue}, reasons=${joinedReasons}`);
						if (stopHookResult.shouldContinue && stopHookResult.reasons?.length) {
							this.showStopHookBlockedMessage(os, stopHookResult.reasons);
							toolCallRound.hookContext = formatQuizHookContext(stopHookResult.reasons);
							this._logService.info(`[QuizToolCallingLoop] Stop hook blocked, continuing with reasons: ${joinedReasons}`);
							stopHookActive = true;
							continue;
						}
					}

					// In Autopilot mode, check if the task is actually done before stopping.
					if (this._options.permissionLevel === 'autopilot' && fetchResult.type === QuizFetchResponseType.Success) {
						const autopilotContinue = this.shouldAutopilotContinue(lastResult);
						if (autopilotContinue) {
							this._logService.info(`[QuizToolCallingLoop] Autopilot internal stop hook: continuing because task may not be complete`);
							this.showAutopilotProgress(os, 'Autopilot: verifying task is done\u2026', 'Autopilot continued working');
							toolCallRound.hookContext = formatQuizHookContext([autopilotContinue]);
							this.autopilotStopHookActive = true;
							continue;
						}
					}

					// No tool calls — process final response
					if (this._invocation.processResponse) {
						const processorContext: IQuizResponseProcessorContext = {
							chatSessionId: conversation.sessionId,
							turn: turn!,
							messages: processedMessages,
						};
						const stream = this._createResponseStream(progress);
						const result = await this._invocation.processResponse(
							processorContext,
							(async function* () { yield modelResponse; })(),
							stream,
							token,
						);
						turn?.setResponse(QuizTurnStatus.Success, { type: 'model', message: modelResponse.text }, undefined, this._toolCallRounds);
						return result ?? { metadata: { toolCallRounds: this._toolCallRounds } };
					}

					// No processResponse — just return the text
					turn?.setResponse(QuizTurnStatus.Success, { type: 'model', message: modelResponse.text }, undefined, this._toolCallRounds);
					return { metadata: { toolCallRounds: this._toolCallRounds } };
				}

				// Execute each tool call via IQuizToolsService
				const toolResults: Record<string, IQuizToolResult> = {};
				for (const toolCall of toolCalls) {
					this._logService.debug(`[QuizToolCallingLoop] executing tool: ${toolCall.name}`);
					progress(`Executing tool: ${toolCall.name}`);

					// Execute PreToolUse hook
					const preHookResult = await this._hookService.executePreToolUseHook(
						toolCall.name,
						toolCall.arguments as unknown as Record<string, unknown>,
						toolCall.id,
						this._options.hooks,
						sessionId,
						token,
						toHookOutputStream(outputStreamFromProgress(progress)),
					);

					if (preHookResult?.permissionDecision === 'deny') {
						this._logService.info(`[QuizToolCallingLoop] PreToolUse hook denied tool: ${toolCall.name}`);
						toolResults[toolCall.id] = {
							text: `Tool "${toolCall.name}" was denied by a hook${preHookResult.permissionDecisionReason ? `: ${preHookResult.permissionDecisionReason}` : ''}`,
							error: true,
						};
						continue;
					}

					// Use updatedInput if provided by hook
					const effectiveArgs = preHookResult?.updatedInput ?? toolCall.arguments as unknown as Record<string, unknown>;

					try {
						const toolContext: IQuizToolInvocationContext = {
							chatSessionId: this._options.chatSessionId,
							requestId: this._options.requestId,
							toolCallId: toolCall.id,
						};
						const result = await this._toolsService.invokeTool(
							toolCall.name,
							effectiveArgs as Record<string, unknown>,
							toolContext,
							token,
						);
						toolResults[toolCall.id] = result;

						// Execute PostToolUse hook
						const postHookResult = await this._hookService.executePostToolUseHook(
							toolCall.name,
							effectiveArgs,
							result.text ?? '',
							toolCall.id,
							this._options.hooks,
							sessionId,
							token,
							toHookOutputStream(outputStreamFromProgress(progress)),
						);

						if (postHookResult?.decision === 'block') {
							this._logService.info(`[QuizToolCallingLoop] PostToolUse hook blocked tool result: ${toolCall.name}`);
						}
					} catch (err) {
						this._logService.error(`[QuizToolCallingLoop] tool execution failed: ${toolCall.name}: ${String(err)}`);
						toolResults[toolCall.id] = {
							text: `Tool "${toolCall.name}" failed: ${String(err)}`,
							error: true,
						};
					}
				}

				this.toolCallResults = { ...this.toolCallResults, ...toolResults };

				// Append tool results to context for next round (create mutable copy)
				(effectiveContext as unknown as { toolCallRounds: IQuizToolCallRound[] }).toolCallRounds = this._toolCallRounds;
				(effectiveContext as unknown as { toolCallResults: Record<string, IQuizToolResult> }).toolCallResults = { ...effectiveContext.toolCallResults, ...toolResults };

				continue; // Loop back for next round

			} catch (e) {
				if (e instanceof CancellationError && lastResult) {
					break;
				}
				throw e;
			}
		}

		this.resolveAutopilotProgress();

		// Max rounds reached or loop ended
		if (lastResult) {
			return {
				errorDetails: lastResult.response.type !== QuizFetchResponseType.Success
					? { message: `Request failed: ${lastResult.response.type}` }
					: undefined,
				metadata: {
					toolCallRounds: this._toolCallRounds,
					toolCallResults: this.toolCallResults,
					maxToolCallsExceeded: (lastResult.chatResult?.metadata as Record<string, unknown>)?.maxToolCallsExceeded as boolean | undefined,
				},
			};
		}

		// No result at all (shouldn't normally happen)
		this._logService.warn(`[QuizToolCallingLoop] loop ended without a result`);
		turn?.setResponse(QuizTurnStatus.Success, { type: 'model', message: '' }, undefined, this._toolCallRounds);
		return {
			metadata: { toolCallRounds: this._toolCallRounds },
		};
	}

	// #endregion

	// #region Internal tool call IDs (aligned with Copilot's createInternalToolCallId/stripInternalToolCallIds)

	/**
	 * Some models reuse tool call IDs, so make sure they are unique.
	 * Aligned with Copilot's ToolCallingLoop.createInternalToolCallId.
	 */
	private createInternalToolCallId(toolCallId: string): string {
		// Note- if this code is ever removed, these IDs will still exist in persisted session metadata!
		return toolCallId + `__vscode-${QuizDefaultToolCallingLoop.NextToolCallId++}`;
	}

	/**
	 * Strips internal tool call ID suffixes from messages before sending to the model.
	 * Aligned with Copilot's ToolCallingLoop.stripInternalToolCallIds.
	 */
	public static stripInternalToolCallIds(messages: IQuizPromptMessage[]): IQuizPromptMessage[] {
		return messages.map(m => {
			if (m.role === QuizPromptMessageRole.Assistant) {
				return {
					...m,
					toolCalls: m.toolCalls?.map(tc => ({
						...tc,
						id: tc.id.split('__vscode-')[0],
					})),
				};
			} else if (m.role === QuizPromptMessageRole.Tool) {
				return {
					...m,
					toolCallId: m.toolCallId?.split('__vscode-')[0],
				};
			}
			return m;
		});
	}

	// #endregion

	// #region Message post-processing (aligned with Copilot's applyMessagePostProcessing/validateToolMessages)

	/**
	 * Applies post-processing to messages before sending to the model.
	 * Strips internal tool call IDs and validates tool message consistency.
	 * Aligned with Copilot's ToolCallingLoop.applyMessagePostProcessing.
	 */
	private applyMessagePostProcessing(messages: IQuizPromptMessage[], options?: { stripOrphanedToolCalls?: boolean }): IQuizPromptMessage[] {
		return this.validateToolMessages(
			QuizDefaultToolCallingLoop.stripInternalToolCallIds(messages),
			options,
		);
	}

	/**
	 * Validates tool messages in the conversation, ensuring:
	 * 1. Tool result messages have a matching tool_call in the preceding assistant message
	 * 2. (When stripOrphanedToolCalls is set) Every tool_call in an assistant message has
	 *    a matching tool result message.
	 *
	 * Aligned with Copilot's ToolCallingLoop.validateToolMessagesCore.
	 */
	public static validateToolMessagesCore(messages: IQuizPromptMessage[], options?: { stripOrphanedToolCalls?: boolean }): { messages: IQuizPromptMessage[]; filterReasons: string[]; strippedToolCallCount: number } {
		const filterReasons: string[] = [];
		let strippedToolCallCount = 0;
		let previousAssistantMessage: IQuizPromptMessage | undefined;
		const filtered = messages.filter(m => {
			if (m.role === QuizPromptMessageRole.Assistant) {
				previousAssistantMessage = m;
			} else if (m.role === QuizPromptMessageRole.Tool) {
				if (!previousAssistantMessage) {
					filterReasons.push('noPreviousAssistantMessage');
					return false;
				}
				if (!previousAssistantMessage.toolCalls?.length) {
					filterReasons.push('noToolCalls');
					return false;
				}
				const toolCall = previousAssistantMessage.toolCalls.find(tc => tc.id === m.toolCallId);
				if (!toolCall) {
					return false;
				}
			}
			return true;
		});

		// Second pass: strip tool_calls from assistant messages that lack matching tool result messages.
		if (!options?.stripOrphanedToolCalls) {
			return { messages: filtered, filterReasons, strippedToolCallCount };
		}

		for (let i = 0; i < filtered.length; i++) {
			const m = filtered[i];
			if (m.role !== QuizPromptMessageRole.Assistant || !m.toolCalls?.length) {
				continue;
			}
			const toolResultIds = new Set<string>();
			for (let j = i + 1; j < filtered.length; j++) {
				const next = filtered[j];
				if (next.role === QuizPromptMessageRole.Assistant) {
					break;
				}
				if (next.role === QuizPromptMessageRole.Tool && next.toolCallId !== undefined) {
					toolResultIds.add(next.toolCallId);
				}
			}
			const orphanedToolCalls = m.toolCalls.filter(tc => !toolResultIds.has(tc.id));
			if (orphanedToolCalls.length > 0) {
				strippedToolCallCount += orphanedToolCalls.length;
				const validToolCalls = m.toolCalls.filter(tc => toolResultIds.has(tc.id));
				(filtered[i] as { toolCalls?: IQuizToolCall[] }).toolCalls = validToolCalls.length > 0 ? validToolCalls : undefined;
			}
		}

		return { messages: filtered, filterReasons, strippedToolCallCount };
	}

	private validateToolMessages(messages: IQuizPromptMessage[], options?: { stripOrphanedToolCalls?: boolean }): IQuizPromptMessage[] {
		const { messages: filtered, filterReasons, strippedToolCallCount } = QuizDefaultToolCallingLoop.validateToolMessagesCore(messages, options);
		if (filterReasons.length || strippedToolCallCount > 0) {
			const allReasons = strippedToolCallCount > 0 ? [...filterReasons, `orphanedToolCalls:${strippedToolCallCount}`] : filterReasons;
			this._logService.warn('Filtered invalid tool messages: ' + allReasons.join(', '));
		}
		return filtered;
	}

	// #endregion

	// #region Hook execution methods (aligned with Copilot's hook execution)

	/**
	 * Execute the SessionStart hook.
	 * Aligned with Copilot's ToolCallingLoop.executeSessionStartHook.
	 */
	protected async executeSessionStartHook(input: IQuizSessionStartHookInput, sessionId: string, outputStream: IQuizResponseStream | undefined, token: CancellationToken): Promise<IQuizStartHookResult> {
		try {
			const results = await this._hookService.executeHook('SessionStart', this._options.hooks, input, sessionId, token);

			const additionalContexts: string[] = [];
			processQuizHookResults({
				hookType: 'SessionStart',
				results,
				outputStream: outputStream ? { hookProgress: (_ht, _em, wm) => { if (wm) { outputStream.warning(wm); } } } : undefined,
				logService: this._logService,
				onSuccess: (output) => {
					if (typeof output === 'object' && output !== null) {
						const hookOutput = output as IQuizSessionStartHookOutput;
						const additionalContext = hookOutput.hookSpecificOutput?.additionalContext;
						if (additionalContext) {
							additionalContexts.push(additionalContext);
							this._logService.trace(`[QuizToolCallingLoop] SessionStart hook provided context: ${additionalContext.substring(0, 100)}...`);
						}
					}
				},
				// SessionStart blocking errors and stopReason are silently ignored
				ignoreErrors: true,
			});

			return {
				additionalContext: additionalContexts.length > 0 ? additionalContexts.join('\n') : undefined,
			};
		} catch (error) {
			if (isQuizHookAbortError(error)) {
				throw error;
			}
			this._logService.error('[QuizToolCallingLoop] Error executing SessionStart hook', error);
			return {};
		}
	}

	/**
	 * Execute the Stop hook.
	 * Aligned with Copilot's ToolCallingLoop.executeStopHook.
	 */
	protected async executeStopHook(input: IQuizStopHookInput, sessionId: string, outputStream: IQuizResponseStream | undefined, token: CancellationToken): Promise<IQuizStopHookResult> {
		try {
			const results = await this._hookService.executeHook('Stop', this._options.hooks, input, sessionId, token);

			const blockingReasons = new Set<string>();
			processQuizHookResults({
				hookType: 'Stop',
				results,
				outputStream: outputStream ? { hookProgress: (_ht, em, _wm) => { if (em) { outputStream.warning(em); } } } : undefined,
				logService: this._logService,
				onSuccess: (output) => {
					if (typeof output === 'object' && output !== null) {
						const hookOutput = output as IQuizStopHookOutput;
						const specific = hookOutput.hookSpecificOutput;
						this._logService.trace(`[QuizToolCallingLoop] Checking hook output: decision=${specific?.decision}, reason=${specific?.reason}`);
						if (specific?.decision === 'block' && specific.reason) {
							this._logService.trace(`[QuizToolCallingLoop] Stop hook blocked: ${specific.reason}`);
							blockingReasons.add(specific.reason);
						}
					}
				},
				// Collect errors as blocking reasons
				onError: (errorMessage) => {
					if (errorMessage) {
						this._logService.trace(`[QuizToolCallingLoop] Stop hook error collected as blocking reason: ${errorMessage}`);
						blockingReasons.add(errorMessage);
					}
				},
			});

			if (blockingReasons.size > 0) {
				return { shouldContinue: true, reasons: [...blockingReasons] };
			}
			return { shouldContinue: false };
		} catch (error) {
			if (isQuizHookAbortError(error)) {
				throw error;
			}
			this._logService.error('[QuizToolCallingLoop] Error executing Stop hook', error);
			return { shouldContinue: false };
		}
	}

	/**
	 * Execute the SubagentStart hook.
	 * Aligned with Copilot's ToolCallingLoop.executeSubagentStartHook.
	 */
	protected async executeSubagentStartHook(input: IQuizSubagentStartHookInput, sessionId: string, outputStream: IQuizResponseStream | undefined, token: CancellationToken): Promise<IQuizSubagentStartHookResult> {
		try {
			const results = await this._hookService.executeHook('SubagentStart', this._options.hooks, input, sessionId, token);

			const additionalContexts: string[] = [];
			processQuizHookResults({
				hookType: 'SubagentStart',
				results,
				outputStream: outputStream ? { hookProgress: (_ht, _em, wm) => { if (wm) { outputStream.warning(wm); } } } : undefined,
				logService: this._logService,
				onSuccess: (output) => {
					if (typeof output === 'object' && output !== null) {
						const hookOutput = output as IQuizSubagentStartHookOutput;
						const additionalContext = hookOutput.hookSpecificOutput?.additionalContext;
						if (additionalContext) {
							additionalContexts.push(additionalContext);
							this._logService.trace(`[QuizToolCallingLoop] SubagentStart hook provided context: ${additionalContext.substring(0, 100)}...`);
						}
					}
				},
				// SubagentStart blocking errors and stopReason are silently ignored
				ignoreErrors: true,
			});

			return {
				additionalContext: additionalContexts.length > 0 ? additionalContexts.join('\n') : undefined,
			};
		} catch (error) {
			if (isQuizHookAbortError(error)) {
				throw error;
			}
			this._logService.error('[QuizToolCallingLoop] Error executing SubagentStart hook', error);
			return {};
		}
	}

	/**
	 * Execute the SubagentStop hook.
	 * Aligned with Copilot's ToolCallingLoop.executeSubagentStopHook.
	 */
	protected async executeSubagentStopHook(input: IQuizSubagentStopHookInput, sessionId: string, outputStream: IQuizResponseStream | undefined, token: CancellationToken): Promise<IQuizSubagentStopHookResult> {
		try {
			const results = await this._hookService.executeHook('SubagentStop', this._options.hooks, input, sessionId, token);

			const blockingReasons = new Set<string>();
			processQuizHookResults({
				hookType: 'SubagentStop',
				results,
				outputStream: outputStream ? { hookProgress: (_ht, em, _wm) => { if (em) { outputStream.warning(em); } } } : undefined,
				logService: this._logService,
				onSuccess: (output) => {
					if (typeof output === 'object' && output !== null) {
						const hookOutput = output as IQuizSubagentStopHookOutput;
						const specific = hookOutput.hookSpecificOutput;
						this._logService.trace(`[QuizToolCallingLoop] Checking SubagentStop hook output: decision=${specific?.decision}, reason=${specific?.reason}`);
						if (specific?.decision === 'block' && specific.reason) {
							this._logService.trace(`[QuizToolCallingLoop] SubagentStop hook blocked: ${specific.reason}`);
							blockingReasons.add(specific.reason);
						}
					}
				},
				// Collect errors as blocking reasons
				onError: (errorMessage) => {
					if (errorMessage) {
						this._logService.trace(`[QuizToolCallingLoop] SubagentStop hook error collected as blocking reason: ${errorMessage}`);
						blockingReasons.add(errorMessage);
					}
				},
			});

			if (blockingReasons.size > 0) {
				return { shouldContinue: true, reasons: [...blockingReasons] };
			}
			return { shouldContinue: false };
		} catch (error) {
			if (isQuizHookAbortError(error)) {
				throw error;
			}
			this._logService.error('[QuizToolCallingLoop] Error executing SubagentStop hook', error);
			return { shouldContinue: false };
		}
	}

	/**
	 * Shows a message when the stop hook blocks the agent from stopping.
	 * Aligned with Copilot's ToolCallingLoop.showStopHookBlockedMessage.
	 */
	protected showStopHookBlockedMessage(outputStream: IQuizResponseStream | undefined, reasons: readonly string[]): void {
		if (outputStream) {
			if (reasons.length === 1) {
				outputStream.progress(reasons[0]);
			} else {
				const formattedReasons = reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
				outputStream.progress(formattedReasons);
			}
		}
		this._logService.trace(`[QuizToolCallingLoop] Stop hook blocked stopping: ${reasons.join('; ')}`);
	}

	/**
	 * Shows a message when the subagent stop hook blocks the subagent from stopping.
	 * Aligned with Copilot's ToolCallingLoop.showSubagentStopHookBlockedMessage.
	 */
	protected showSubagentStopHookBlockedMessage(outputStream: IQuizResponseStream | undefined, reasons: readonly string[]): void {
		if (outputStream) {
			if (reasons.length === 1) {
				outputStream.progress(reasons[0]);
			} else {
				const formattedReasons = reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
				outputStream.progress(formattedReasons);
			}
		}
		this._logService.trace(`[QuizToolCallingLoop] SubagentStop hook blocked stopping: ${reasons.join('; ')}`);
	}

	// #endregion

	// #region Autopilot logic (aligned with Copilot's autopilot methods)

	/**
	 * Autopilot stop hook — the model needs to call `task_complete` to signal it's done.
	 * If it stops without calling it, we nudge it to keep going.
	 * Aligned with Copilot's ToolCallingLoop.shouldAutopilotContinue.
	 */
	protected shouldAutopilotContinue(result: IQuizToolCallSingleResult): string | undefined {
		if (this.taskCompleted) {
			this._logService.info('[QuizToolCallingLoop] Autopilot: task_complete was called, stopping');
			return undefined;
		}

		// might have called task_complete alongside other tools in an earlier round
		const calledTaskComplete = this._toolCallRounds.some(
			round => round.toolCalls.some(tc => tc.name === QuizDefaultToolCallingLoop.TASK_COMPLETE_TOOL_NAME)
		);
		if (calledTaskComplete) {
			this.taskCompleted = true;
			this._logService.info('[QuizToolCallingLoop] Autopilot: task_complete found in history, stopping');
			return undefined;
		}

		// If the model produced a substantive text response with no tool calls, treat it as a final summary
		if (result.round.toolCalls.length === 0 && result.round.response.trim().length > 0) {
			this._logService.info('[QuizToolCallingLoop] Autopilot: model produced a text-only response, treating as done');
			return undefined;
		}

		// safety valve — only give up after exhausting all continuation attempts
		if (this.autopilotIterationCount >= QuizDefaultToolCallingLoop.MAX_AUTOPILOT_ITERATIONS) {
			this._logService.info(`[QuizToolCallingLoop] Autopilot: hit max iterations (${QuizDefaultToolCallingLoop.MAX_AUTOPILOT_ITERATIONS}), letting it stop`);
			return undefined;
		}

		// If we already nudged once and the model still produced no tool calls, bail out
		if (this.autopilotStopHookActive && result.round.toolCalls.length === 0) {
			this._logService.info('[QuizToolCallingLoop] Autopilot: prior nudge produced no tool calls, stopping to avoid wasted requests');
			return undefined;
		}

		this.autopilotIterationCount++;
		return 'You have not yet marked the task as complete using the task_complete tool. ' +
			'You must call task_complete when done — whether the task involved code changes, answering a question, or any other interaction.\n\n' +
			'Do NOT repeat or restate your previous response. Pick up where you left off.\n\n' +
			'If you were planning, stop planning and start implementing. ' +
			'You are not done until you have fully completed the task.\n\n' +
			'IMPORTANT: Do NOT call task_complete if:\n' +
			'- You have open questions or ambiguities — make good decisions and keep working\n' +
			'- You encountered an error — try to resolve it or find an alternative approach\n' +
			'- There are remaining steps — complete them first\n\n' +
			'When you ARE done, first provide a brief text summary of what was accomplished, then call task_complete. ' +
			'Both the summary message and the tool call are required.\n\n' +
			'Keep working autonomously until the task is truly finished, then call task_complete.';
	}

	/**
	 * Shows a progress spinner in the chat stream while autopilot continues.
	 * Aligned with Copilot's ToolCallingLoop.showAutopilotProgress.
	 */
	private showAutopilotProgress(outputStream: IQuizResponseStream | undefined, _message: string, _pastTenseMessage: string): void {
		this.resolveAutopilotProgress();
		// Simplified: just log progress. Full implementation would use a DeferredPromise
		// with outputStream.progress() for spinner behavior.
		if (outputStream) {
			outputStream.progress('Autopilot continuing\u2026');
		}
		this.autopilotProgressDeferred = {
			complete: () => { this.autopilotProgressDeferred = undefined; },
		};
	}

	/**
	 * Resolves any pending autopilot progress spinner.
	 * Aligned with Copilot's ToolCallingLoop.resolveAutopilotProgress.
	 */
	private resolveAutopilotProgress(): void {
		if (this.autopilotProgressDeferred) {
			this.autopilotProgressDeferred.complete(undefined);
			this.autopilotProgressDeferred = undefined;
		}
	}

	// #endregion

	// #region Auto-retry (aligned with Copilot's shouldAutoRetry)

	/**
	 * Whether the loop should auto-retry after a failed fetch in auto-approve/autopilot mode.
	 * Does not retry rate-limited, quota-exceeded, or cancellation errors.
	 * Aligned with Copilot's ToolCallingLoop.shouldAutoRetry.
	 */
	private shouldAutoRetry(response: IQuizFetchResult): boolean {
		const permLevel = this._options.permissionLevel;
		if (permLevel !== 'autoApprove' && permLevel !== 'autopilot') {
			return false;
		}
		if (this.autopilotRetryCount >= QuizDefaultToolCallingLoop.MAX_AUTOPILOT_RETRIES) {
			return false;
		}
		switch (response.type) {
			case QuizFetchResponseType.RateLimited:
			case QuizFetchResponseType.QuotaExceeded:
			case QuizFetchResponseType.Canceled:
			case QuizFetchResponseType.OffTopic:
				return false;
			default:
				return response.type !== QuizFetchResponseType.Success;
		}
	}

	// #endregion

	// #region Tool call limit (aligned with Copilot's hitToolCallLimit)

	private hitToolCallLimit(stream: IQuizResponseStream | undefined, lastResult: IQuizToolCallSingleResult): IQuizToolCallSingleResult {
		if (stream && this._options.onHitToolCallLimit === QuizToolCallLimitBehavior.Confirm) {
			stream.progress(`Maximum tool call rounds reached. [Configure max requests].`);
		}

		lastResult.chatResult = {
			...lastResult.chatResult,
			metadata: {
				...lastResult.chatResult?.metadata,
				maxToolCallsExceeded: true,
			},
		};

		return lastResult;
	}

	// #endregion

	// #region Model request (unchanged core logic)

	/**
	 * Send messages to the model via IQuizEndpoint.
	 * Accumulates streaming chunks into a single IQuizResponsePart.
	 */
	private async _sendModelRequest(
		messages: readonly IQuizPromptMessage[],
		round: number,
		token: CancellationToken,
	): Promise<IQuizResponsePart & { usage?: IQuizTokenUsage; thinking?: IQuizThinkingData; statefulMarker?: string }> {
		const endpoint = this._options.endpoint;
		if (!endpoint.isAvailable()) {
			return {
				text: '[Quiz: No model endpoint available]',
				toolCalls: undefined,
				finishReason: 'stop',
			};
		}

		// Build request options with debug name and round info
		const requestOptions: IQuizChatRequestOptions = {
			debugName: `quiz-round-${round}`,
			conversationId: this._options.chatSessionId,
			turnId: this._options.requestId,
			isConversationRequest: true,
		};

		let textBuffer = '';
		const allToolCalls: IQuizToolCall[] = [];
		let finishReason: string | undefined;
		let usage: IQuizTokenUsage | undefined;
		let thinkingData: IQuizThinkingData | undefined;
		let statefulMarker: string | undefined;

		try {
			for await (const delta of endpoint.sendChatRequest(messages, requestOptions, token)) {
				if (token.isCancellationRequested) {
					break;
				}
				if (delta.text) {
					textBuffer += delta.text;
				}
				if (delta.toolCalls) {
					for (const tc of delta.toolCalls) {
						allToolCalls.push(tc);
					}
				}
				if (delta.thinking) {
					const prevText = thinkingData?.text;
					const prevStr = Array.isArray(prevText) ? prevText.join('') : (prevText ?? '');
					const deltaText = delta.thinking.text;
					const deltaStr = Array.isArray(deltaText) ? deltaText.join('') : (deltaText ?? '');
					thinkingData = { text: prevStr + deltaStr, metadata: delta.thinking.metadata };
				}
				if (delta.statefulMarker) {
					statefulMarker = delta.statefulMarker;
				}
				if (delta.usage) {
					usage = delta.usage;
				}
				if (delta.finishReason) {
					finishReason = delta.finishReason;
				}
			}
		} catch (err) {
			if (token.isCancellationRequested) {
				return { text: '', toolCalls: undefined, finishReason: 'cancel' };
			}
			this._logService.error(`[QuizToolCallingLoop] model request failed: ${String(err)}`);
			return { text: `Model request failed: ${String(err)}`, toolCalls: undefined, finishReason: 'error' };
		}

		return {
			text: textBuffer,
			toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
			finishReason: finishReason ?? (allToolCalls.length > 0 ? 'tool_calls' : 'stop'),
			usage,
			thinking: thinkingData,
			statefulMarker,
		};
	}

	private _createResponseStream(progress: (message: string) => void): IQuizResponseStream {
		return {
			markdown(_value: string) { /* no-op — will be connected to chat response stream */ },
			progress(message: string) { progress(message); },
			warning(message: string) { progress(`Warning: ${message}`); },
		};
	}

	// #endregion
}

// #region Helper: progress callback → IQuizResponseStream adapter

/**
 * Adapts a simple progress callback into an IQuizResponseStream for hook methods.
 */
function outputStreamFromProgress(progress: ((message: string) => void) | undefined): IQuizResponseStream | undefined {
	if (!progress) {
		return undefined;
	}
	return {
		markdown() { },
		progress(message: string) { progress(message); },
		warning(message: string) { progress(`Warning: ${message}`); },
	};
}

/**
 * Adapts an IQuizResponseStream into an IQuizHookOutputStream for hook service calls.
 */
function toHookOutputStream(stream: IQuizResponseStream | undefined): IQuizHookOutputStream | undefined {
	if (!stream) {
		return undefined;
	}
	return {
		hookProgress(_hookType: string, errorMessage?: string, warningMessage?: string) {
			if (errorMessage) {
				stream.warning(errorMessage);
			}
			if (warningMessage) {
				stream.progress(warningMessage);
			}
		},
	};
}

// #endregion
