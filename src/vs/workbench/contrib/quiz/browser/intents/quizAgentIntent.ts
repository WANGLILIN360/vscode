/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizBuildPromptContext,
	IQuizChatResult,
	IQuizChatResponse,
	IQuizErrorDetails,
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
} from '../../common/intents/quizIntents.js';
import { QuizPseudoStopStartResponseProcessor } from './quizResponseProcessors.js';
import { QuizRendererIntentInvocationImpl } from './quizBaseIntentInvocation.js';

export class QuizAgentIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Agent;
	readonly id = QuizAgentIntent.ID;
	readonly description = 'Agent mode: use tools to accomplish tasks';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizAgentIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizAgentIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizAgentIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = false;

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
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
				{ name: 'quiz_editFile', description: 'Edit an existing file', tags: ['edit'] },
				{ name: 'quiz_readFile', description: 'Read a file from the workspace', tags: ['read'] },
				{ name: 'quiz_createFile', description: 'Create a new file', tags: ['edit'] },
				{ name: 'quiz_searchWorkspace', description: 'Search the workspace for code', tags: ['search'] },
				{ name: 'quiz_listDirectory', description: 'List directory contents', tags: ['read'] },
				{ name: 'quiz_runTask', description: 'Run a task from the task list', tags: ['execution'] },
				{ name: 'quiz_getErrors', description: 'Get diagnostics/errors for a file', tags: ['diagnostics'] },
			);
			const maxRequests = this.configurationService.getValue<number>('chat.agent.maxRequests') ?? 200;
			if (maxRequests > 0) {
				tools.push({ name: 'quiz_manageTodoList', description: 'Manage a todo list for tracking progress', tags: ['planning'] });
			}
		}
		return tools;
	}

	override modifyErrorDetails(errorDetails: IQuizErrorDetails, _response: IQuizChatResponse): IQuizErrorDetails {
		return { ...errorDetails, responseIsIncomplete: true };
	}

	processResponse?(
		context: IQuizResponseProcessorContext,
		inputStream: AsyncIterable<IQuizResponsePart>,
		outputStream: IQuizResponseStream,
		token: CancellationToken,
	): Promise<IQuizChatResult | void> {
		const processor = new QuizPseudoStopStartResponseProcessor();
		return processor.processResponse(context, inputStream, outputStream, token);
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
			'You are in agent mode. You have access to tools that let you read files, edit code, search the codebase, and run tasks.',
			'When using tools, be thorough and precise. Break complex tasks into steps.',
			'Always verify your changes by reading the modified files after editing.',
			'If a task is unclear, ask the user for clarification before proceeding.',
		].join('\n\n');
	}
}
