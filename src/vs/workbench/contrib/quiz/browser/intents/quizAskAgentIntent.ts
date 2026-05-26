/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizBuildPromptContext,
	IQuizChatResult,
	IQuizIntent,
	IQuizIntentEndpoint,
	IQuizIntentInvocation,
	IQuizIntentInvocationContext,
	IQuizPromptMessage,
	IQuizResponsePart,
	IQuizResponseProcessorContext,
	IQuizResponseStream,
	IQuizToolInfo,
	QuizIntent,
	QuizPromptMessageRole,
	QuizStreamingMarkdownReplyInterpreter,
} from '../../common/intents/quizIntents.js';
import { QuizRendererIntentInvocationImpl } from './quizBaseIntentInvocation.js';

export class QuizAskAgentIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.AskAgent;
	readonly id = QuizAskAgentIntent.ID;
	readonly description = 'Ask about code: answer questions without making changes';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizAskAgentIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizAskAgentIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizAskAgentIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = false;

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
	) {
		super(intent, location, endpoint);
	}

	override createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];
		messages.push({ role: QuizPromptMessageRole.System, content: this._buildSystemPrompt() });
		this._appendHistoryAndToolRounds(messages, context);
		messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		return messages;
	}

	override getAvailableTools(): IQuizToolInfo[] {
		const tools: IQuizToolInfo[] = [];
		if (this.endpoint.supportsToolCalls) {
			tools.push(
				{ name: 'quiz_searchWorkspace', description: 'Search the workspace for code', tags: ['search', 'vscode_codesearch'] },
				{ name: 'quiz_readFile', description: 'Read a file from the workspace', tags: ['read'] },
				{ name: 'quiz_listDirectory', description: 'List directory contents', tags: ['read'] },
			);
		}
		return tools;
	}

	processResponse?(
		_context: IQuizResponseProcessorContext,
		inputStream: AsyncIterable<IQuizResponsePart>,
		outputStream: IQuizResponseStream,
		_token: CancellationToken,
	): Promise<IQuizChatResult | void> {
		const interpreter = new QuizStreamingMarkdownReplyInterpreter();
		return interpreter.processResponse(_context, inputStream, outputStream, _token);
	}

	private _appendHistoryAndToolRounds(messages: IQuizPromptMessage[], context: IQuizBuildPromptContext): void {
		for (const turn of context.history) {
			messages.push({ role: QuizPromptMessageRole.User, content: turn.request.message });
			if (turn.response) {
				messages.push({
					role: QuizPromptMessageRole.Assistant,
					content: turn.response.message.type === 'model' ? turn.response.message.message : turn.response.message.message,
				});
			}
		}
		if (context.toolCallRounds) {
			for (const round of context.toolCallRounds) {
				if (round.response) {
					messages.push({ role: QuizPromptMessageRole.Assistant, content: round.response, toolCalls: round.toolCalls });
				}
				for (const toolCall of round.toolCalls) {
					const result = context.toolCallResults?.[toolCall.id];
					if (result) {
						messages.push({
							role: QuizPromptMessageRole.Tool,
							content: result.text ?? '',
							toolCallId: toolCall.id,
							toolName: toolCall.name,
						});
					}
				}
			}
		}
	}

	private _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'You are in ask mode. Answer questions about code without making changes.',
			'Use the search tool to find relevant code. Read files when needed to provide accurate answers.',
			'Provide clear, concise explanations. Use code blocks for code examples.',
		].join('\n\n');
	}
}
