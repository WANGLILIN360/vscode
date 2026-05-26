/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	IQuizBuildPromptContext,
	IQuizChatResult,
	IQuizIntentInvocation,
	IQuizPromptMessage,
	IQuizResponsePart,
	IQuizResponseProcessorContext,
	IQuizResponseStream,
	IQuizToolCall,
	IQuizToolCallRound,
	IQuizToolResult,
	IQuizThinkingData,
	QuizTurnStatus,
} from '../intents/quizIntents.js';
import { IQuizEndpoint, IQuizChatRequestOptions, IQuizTokenUsage } from '../endpoint/quizEndpoint.js';
import { IQuizToolsService, IQuizToolInvocationContext } from '../tools/quizToolsService.js';
import { QuizConversation, QuizToolCallRoundImpl } from './quizConversation.js';

// #region Tool calling loop options (aligned with Copilot's IToolCallingLoopOptions)

export interface IQuizToolCallingLoopOptions {
	readonly maxRounds: number;
	readonly endpoint: IQuizEndpoint;
	readonly conversation: QuizConversation;
	readonly chatSessionId: string;
	readonly requestId: string;
}

// #endregion

// #region ToolCallingLoop (aligned with Copilot's ToolCallingLoop)

/**
 * Core tool calling loop that:
 * 1. Builds prompt via IQuizIntentInvocation
 * 2. Sends to model via IQuizEndpoint
 * 3. Checks for tool calls in response
 * 4. Executes tools via IQuizToolsService and appends results
 * 5. Loops until no tool calls or max rounds reached
 */
export class QuizDefaultToolCallingLoop extends Disposable {

	private _toolCallRounds: IQuizToolCallRound[] = [];

	constructor(
		private readonly _invocation: IQuizIntentInvocation,
		private readonly _options: IQuizToolCallingLoopOptions,
		private readonly _toolsService: IQuizToolsService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	get currentToolCallRounds(): readonly IQuizToolCallRound[] {
		return this._toolCallRounds;
	}

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

		for (let round = 0; round < this._options.maxRounds; round++) {
			if (token.isCancellationRequested) {
				turn?.setResponse(QuizTurnStatus.Cancelled, { type: 'model', message: '' }, undefined, this._toolCallRounds);
				return { metadata: { toolCallRounds: this._toolCallRounds, cancelled: true } };
			}

			this._logService.debug(`[QuizToolCallingLoop] round ${round + 1}/${this._options.maxRounds}`);

			// 1. Build prompt
			const promptResult = await this._invocation.buildPrompt(
				effectiveContext,
				{ report: (msg: string) => progress(msg) },
				token,
			);

			if (token.isCancellationRequested) {
				turn?.setResponse(QuizTurnStatus.Cancelled, { type: 'model', message: '' }, undefined, this._toolCallRounds);
				return { metadata: { toolCallRounds: this._toolCallRounds, cancelled: true } };
			}

			// 2. Send to model (stub for now)
			const modelResponse = await this._sendModelRequest(promptResult.messages, round, token);

			if (token.isCancellationRequested) {
				turn?.setResponse(QuizTurnStatus.Cancelled, { type: 'model', message: '' }, undefined, this._toolCallRounds);
				return { metadata: { toolCallRounds: this._toolCallRounds, cancelled: true } };
			}

			// 3. Check for tool calls
			if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
				// Execute tool calls and create a round record
				const roundId = generateUuid();
				const toolCallRound: IQuizToolCallRound = new QuizToolCallRoundImpl(
					roundId,
					modelResponse.text,
					[...modelResponse.toolCalls],
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
				this._toolCallRounds.push(toolCallRound);
				turn?.addToolCallRound(toolCallRound);

				// Execute each tool call via IQuizToolsService
				const toolResults: Record<string, IQuizToolResult> = {};
				for (const toolCall of modelResponse.toolCalls) {
					this._logService.debug(`[QuizToolCallingLoop] executing tool: ${toolCall.name}`);
					progress(`Executing tool: ${toolCall.name}`);

					try {
						const toolContext: IQuizToolInvocationContext = {
							chatSessionId: this._options.chatSessionId,
							requestId: this._options.requestId,
							toolCallId: toolCall.id,
						};
						const result = await this._toolsService.invokeTool(
							toolCall.name,
							toolCall.arguments as unknown as Record<string, unknown>,
							toolContext,
							token,
						);
						toolResults[toolCall.id] = result;
					} catch (err) {
						this._logService.error(`[QuizToolCallingLoop] tool execution failed: ${toolCall.name}: ${String(err)}`);
						toolResults[toolCall.id] = {
							text: `Tool "${toolCall.name}" failed: ${String(err)}`,
							error: true,
						};
					}
				}

				// Append tool results to context for next round (create mutable copy)
				(effectiveContext as unknown as { toolCallRounds: IQuizToolCallRound[] }).toolCallRounds = this._toolCallRounds;
				(effectiveContext as unknown as { toolCallResults: Record<string, IQuizToolResult> }).toolCallResults = { ...effectiveContext.toolCallResults, ...toolResults };

				continue; // Loop back for next round
			}

			// 4. No tool calls — process final response
			if (this._invocation.processResponse) {
				const processorContext: IQuizResponseProcessorContext = {
					chatSessionId: conversation.sessionId,
					turn: turn!,
					messages: promptResult.messages,
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

			// 5. No processResponse — just return the text
			turn?.setResponse(QuizTurnStatus.Success, { type: 'model', message: modelResponse.text }, undefined, this._toolCallRounds);
			return { metadata: { toolCallRounds: this._toolCallRounds } };
		}

		// Max rounds reached
		this._logService.warn(`[QuizToolCallingLoop] max rounds (${this._options.maxRounds}) reached`);
		turn?.setResponse(QuizTurnStatus.Success, { type: 'model', message: '' }, undefined, this._toolCallRounds);
		return {
			errorDetails: { message: `Maximum tool call rounds (${this._options.maxRounds}) reached` },
			metadata: { toolCallRounds: this._toolCallRounds, maxRoundsReached: true },
		};
	}

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
}

// #endregion
