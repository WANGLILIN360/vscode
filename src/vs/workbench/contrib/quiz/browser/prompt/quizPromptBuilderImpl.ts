/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Layer: browser — DI-injected implementation of IQuizPromptBuilder.
// Moved from common/ to comply with the four-layer architecture rules.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	IQuizBuildPromptContext,
	IQuizBuildPromptResult,
	IQuizBuildPromptProgress,
	IQuizPromptMessage,
	IQuizIntentInvocation,
	IQuizChatVariablesCollection,
	IQuizToolInfo,
	QuizPromptMessageRole,
} from '../../common/intents/quizIntents.js';
import { IQuizToolsService } from '../../common/tools/quizToolsService.js';
import { IQuizPromptBuilder } from '../../common/prompt/quizPromptBuilder.js';
import { quizTag } from '../../common/prompt/quizPromptTag.js';
import { quizSafetyRulesForModel } from '../../common/prompt/quizPromptSafetyRules.js';
import { quizDetectToolCapabilities, quizBuildToolDependentInstructions, quizBuildToolUseInstructions, quizBuildEditInstructions } from '../../common/prompt/quizDetectToolCapabilities.js';
import { quizSection, quizRenderSections, quizTextChunk, quizText } from '../../common/prompt/quizPromptText.js';

export class QuizPromptBuilderImpl extends Disposable implements IQuizPromptBuilder {

	constructor(
		@IQuizToolsService private readonly _toolsService: IQuizToolsService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	async buildPrompt(
		invocation: IQuizIntentInvocation,
		context: IQuizBuildPromptContext,
		progress: IQuizBuildPromptProgress,
		token: CancellationToken,
	): Promise<IQuizBuildPromptResult> {
		if (token.isCancellationRequested) {
			return { messages: [], tokenCount: 0 };
		}

		progress.report('Building prompt...');

		// 1. Gather tools
		const availableTools = await this._gatherTools(invocation, context);
		progress.report(`Found ${availableTools.length} available tools`);

		// 2. Build system message
		const systemMessage = this._buildSystemMessage(context, availableTools);

		// 3. Build conversation history messages
		const historyMessages = this._buildHistoryMessages(context);

		// 4. Build user message with variables
		const userMessage = this._buildUserMessage(context);

		// 5. Build tool result messages (if any from previous rounds)
		const toolResultMessages = this._buildToolResultMessages(context);

		// 6. Assemble all messages
		const messages: IQuizPromptMessage[] = [
			systemMessage,
			...historyMessages,
			...toolResultMessages,
			userMessage,
		].filter(Boolean) as IQuizPromptMessage[];

		// 7. Compute approximate token count
		const tokenCount = this._estimateTokenCount(messages);

		this._logService.debug(`[QuizPromptBuilder] Built prompt with ${messages.length} messages, ~${tokenCount} tokens`);

		return {
			messages,
			tokenCount,
		};
	}

	private async _gatherTools(
		invocation: IQuizIntentInvocation,
		context: IQuizBuildPromptContext,
	): Promise<IQuizToolInfo[]> {
		// Let the invocation provide its own tools, or use the tools service
		const invocationTools = invocation.getAvailableTools?.();
		if (invocationTools) {
			return invocationTools;
		}
		return this._toolsService.getAvailableTools(context.tools?.toolReferences?.[0]?.name);
	}

	private _buildSystemMessage(
		context: IQuizBuildPromptContext,
		tools: IQuizToolInfo[],
	): IQuizPromptMessage {
		const caps = quizDetectToolCapabilities(tools);
		const modelFamily = context.tools?.modelFamily ?? '';

		const sections = [
			// Safety rules (aligned with Copilot's SafetyRules)
			quizSection('safety', [quizTextChunk(quizSafetyRulesForModel(modelFamily))], { priority: 100 }),

			// Instructions (aligned with Copilot's DefaultAgentPrompt <instructions> tag)
			quizSection('instructions', [
				quizTextChunk('You are a highly sophisticated automated coding agent with expert-level knowledge across many different programming languages and frameworks.'),
				quizTextChunk('The user will ask a question, or ask you to perform a task, and it may require lots of research to answer correctly. There is a selection of tools that let you perform actions or retrieve helpful context to answer the user\'s question.'),
				quizTextChunk('You will be given some context and attachments along with the user prompt. You can use them if they are relevant to the task, and ignore them if not.'),
				quizTextChunk('If you can infer the project type (languages, frameworks, and libraries) from the user\'s query or the context that you have, make sure to keep them in mind when making changes.'),
				quizTextChunk('If you aren\'t sure which tool is relevant, you can call multiple tools. You can call tools repeatedly to take actions or gather as much context as needed until you have completed the task fully. Don\'t give up unless you are sure the request cannot be fulfilled with the tools you have. It\'s YOUR RESPONSIBILITY to make sure that you have done all you can to collect necessary context.'),
				quizTextChunk('When reading files, prefer reading large meaningful chunks rather than consecutive small sections to minimize tool calls and gain better context.'),
				quizTextChunk('Don\'t make assumptions about the situation- gather context first, then perform the task or answer the question.'),
				quizTextChunk('Don\'t repeat yourself after a tool call, pick up where you left off.'),
				// Tool-dependent instructions
				quizText(quizBuildToolDependentInstructions(caps), { priority: 1 }),
			], { priority: 50 }),

			// Tool use instructions (aligned with Copilot's <toolUseInstructions> tag)
			quizSection('toolUseInstructions', [
				quizTextChunk(quizBuildToolUseInstructions(caps)),
			], { priority: 40 }),
		];

		// Edit instructions (only if editing tools are available)
		const editInstructions = quizBuildEditInstructions(caps);
		if (editInstructions) {
			sections.push(quizSection('editFileInstructions', [quizTextChunk(editInstructions)], { priority: 30 }));
		}

		// Output formatting (aligned with Copilot's <outputFormatting> tag)
		sections.push(quizSection('outputFormatting', [
			quizTextChunk('Use proper Markdown formatting in your answers. When referring to a filename or symbol in the user\'s workspace, wrap it in backticks.'),
			quizTextChunk(quizTag('example', 'The class `Person` is in `src/models/person.ts`.')),
		], { priority: 20 }));

		// Mode instructions (from intent)
		if (context.modeInstructions) {
			sections.push(quizSection('modeInstructions', [quizTextChunk(context.modeInstructions)], { priority: 60 }));
		}

		// Additional hook context
		if (context.additionalHookContext) {
			sections.push(quizSection('hookContext', [quizTextChunk(context.additionalHookContext)], { priority: 10 }));
		}

		// Tool descriptions (aligned with Copilot's tool schema rendering)
		if (tools.length > 0) {
			const toolChunks = tools.map(tool => {
				let desc = `## ${tool.name}\n${tool.description}`;
				if (tool.inputSchema && Object.keys(tool.inputSchema).length > 0) {
					desc += `\nInput schema: ${JSON.stringify(tool.inputSchema, undefined, 2)}`;
				}
				return quizTextChunk(desc);
			});
			sections.push(quizSection('availableTools', toolChunks, { priority: -1 }));
		}

		const content = quizRenderSections(sections);

		return {
			role: QuizPromptMessageRole.System,
			content,
		};
	}

	private _buildHistoryMessages(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		if (!context.history || context.history.length === 0) {
			return [];
		}

		const messages: IQuizPromptMessage[] = [];
		for (const turn of context.history) {
			// User message
			if (turn.request) {
				messages.push({
					role: QuizPromptMessageRole.User,
					content: turn.request.message ?? '',
				});
			}
			// Assistant message
			if (turn.response) {
				messages.push({
					role: QuizPromptMessageRole.Assistant,
					content: turn.response.message?.message ?? '',
				});
			}
		}

		return messages;
	}

	private _buildUserMessage(context: IQuizBuildPromptContext): IQuizPromptMessage {
		const parts: string[] = [];

		// Main query
		parts.push(context.query);

		// Chat variables
		if (context.chatVariables) {
			const variableContent = this._renderChatVariables(context.chatVariables);
			if (variableContent) {
				parts.push(variableContent);
			}
		}

		// Working set context
		if (context.workingSet) {
			const workingSetContent = this._renderWorkingSet(context.workingSet);
			if (workingSetContent) {
				parts.push(workingSetContent);
			}
		}

		return {
			role: QuizPromptMessageRole.User,
			content: parts.join('\n\n'),
		};
	}

	private _buildToolResultMessages(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];

		// Add tool call rounds as assistant + tool messages
		if (context.toolCallRounds && context.toolCallRounds.length > 0) {
			for (const round of context.toolCallRounds) {
				// Assistant message with tool calls
				if (round.toolCalls && round.toolCalls.length > 0) {
					messages.push({
						role: QuizPromptMessageRole.Assistant,
						content: round.response ?? '',
						toolCalls: round.toolCalls,
					});

					// Tool results
					if (context.toolCallResults) {
						for (const toolCall of round.toolCalls) {
							const result = context.toolCallResults[toolCall.id];
							if (result) {
								messages.push({
									role: QuizPromptMessageRole.Tool,
									toolName: toolCall.name,
									content: result.text ?? '',
									toolCallId: toolCall.id,
								});
							}
						}
					}
				}
			}
		}

		return messages;
	}

	private _renderChatVariables(variables: IQuizChatVariablesCollection): string {
		const parts: string[] = [];
		for (const ref of variables.references) {
			if (ref.value && typeof ref.value === 'string') {
				parts.push(`# ${ref.name}\n${ref.value}`);
			} else if (ref.value && typeof ref.value === 'object') {
				parts.push(`# ${ref.name}\n${JSON.stringify(ref.value)}`);
			}
		}
		return parts.join('\n\n');
	}

	private _renderWorkingSet(workingSet: readonly { document?: { uri?: { toString(): string } } }[]): string {
		const parts: string[] = [];
		for (const entry of workingSet) {
			if (entry.document?.uri) {
				parts.push(`- ${entry.document.uri.toString()}`);
			}
		}
		if (parts.length === 0) {
			return '';
		}
		return `# Open Files\n${parts.join('\n')}`;
	}

	private _estimateTokenCount(messages: IQuizPromptMessage[]): number {
		let totalChars = 0;
		for (const msg of messages) {
			totalChars += msg.content.length;
		}
		return Math.ceil(totalChars / 4);
	}
}
