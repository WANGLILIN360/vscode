/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizBuildPromptContext,
	IQuizChatResult,
	IQuizDocumentContext,
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

export class QuizEditIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Edit;
	readonly id = QuizEditIntent.ID;
	readonly description = 'Edit mode: make changes to existing code using tools';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizEditIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizEditIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
			invocationContext.documentContext,
		);
	}
}

export class QuizEditIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = true;
	private readonly _workingSet: Set<string> = new Set();

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		documentContext: IQuizDocumentContext | undefined,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ILogService logService: ILogService,
	) {
		super(intent, location, endpoint, documentContext);
		if (documentContext) {
			this._workingSet.add(documentContext.documentUri.toString());
		}
	}

	override createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];
		messages.push({ role: QuizPromptMessageRole.System, content: this._buildSystemPrompt() });
		this._appendWorkingSet(messages);
		this._appendHistoryAndToolRounds(messages, context);
		messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		return messages;
	}

	override getAvailableTools(): IQuizToolInfo[] {
		const tools: IQuizToolInfo[] = [];
		if (this.endpoint.supportsToolCalls) {
			tools.push(
				{ name: 'quiz_editFile', description: 'Edit an existing file using the editor', tags: ['edit'] },
				{ name: 'quiz_replaceString', description: 'Replace a specific string in a file', tags: ['edit'] },
				{ name: 'quiz_multiReplaceString', description: 'Replace multiple strings in a file', tags: ['edit'] },
				{ name: 'quiz_createFile', description: 'Create a new file', tags: ['edit'] },
				{ name: 'quiz_searchWorkspace', description: 'Search for code across the workspace', tags: ['search', 'vscode_codesearch'] },
				{ name: 'quiz_listDirectory', description: 'List contents of a directory', tags: ['read'] },
				{ name: 'quiz_readFile', description: 'Read the contents of a file', tags: ['read'] },
			);
		}
		return tools;
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

	private _appendWorkingSet(messages: IQuizPromptMessage[]): void {
		if (this._workingSet.size > 0) {
			const files = Array.from(this._workingSet).join('\n');
			messages.push({
				role: QuizPromptMessageRole.System,
				content: `Working set of files you can edit:\n${files}`,
			});
		}
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
			'You are in edit mode. Your primary task is to make changes to existing code using the provided tools.',
			'The working set defines which files you are currently editing. Only edit files in the working set.',
			'Use the search tool to find relevant code before making edits.',
			'When editing, preserve the existing code style and formatting.',
			'Always verify your changes by reading the modified file after editing.',
		].join('\n\n');
	}
}
