/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizBuildPromptContext,
	IQuizDocumentContext,
	IQuizIntent,
	IQuizIntentEndpoint,
	IQuizIntentInvocation,
	IQuizIntentInvocationContext,
	IQuizPromptMessage,
	IQuizToolInfo,
	QuizIntent,
	QuizPromptMessageRole,
} from '../../common/intents/quizIntents.js';
import { QuizRendererIntentInvocationImpl } from './quizBaseIntentInvocation.js';

export class QuizNewNotebookIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.NewNotebook;
	readonly id = QuizNewNotebookIntent.ID;
	readonly description = 'New Notebook: create a new Jupyter notebook';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizNewNotebookIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizNewNotebookIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizNewNotebookIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = false;

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService _logService: ILogService,
	) {
		super(intent, location, endpoint);
	}

	override createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];
		messages.push({ role: QuizPromptMessageRole.System, content: this._buildSystemPrompt() });
		messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		return messages;
	}

	private _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Create a new Jupyter notebook with code cells.',
			'Include markdown explanations and runnable code cells.',
			'Make sure imports and dependencies are properly handled.',
		].join('\n\n');
	}
}

export class QuizNotebookEditorIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.NotebookEditor;
	readonly id = QuizNotebookEditorIntent.ID;
	readonly description = 'Notebook Editor: edit Jupyter notebooks';
	readonly locations = [ChatAgentLocation.Notebook];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizNotebookEditorIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizNotebookEditorIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
			invocationContext.documentContext,
		);
	}
}

export class QuizNotebookEditorIntentInvocation extends QuizRendererIntentInvocationImpl {

	override readonly codeblocksRepresentEdits = true;

	constructor(
		intent: IQuizIntent,
		location: ChatAgentLocation,
		endpoint: IQuizIntentEndpoint,
		documentContext: IQuizDocumentContext | undefined,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
	) {
		super(intent, location, endpoint, documentContext);
	}

	override createPromptElements(context: IQuizBuildPromptContext): IQuizPromptMessage[] {
		const messages: IQuizPromptMessage[] = [];
		messages.push({ role: QuizPromptMessageRole.System, content: this._buildSystemPrompt() });
		if (this.documentContext) {
			messages.push({
				role: QuizPromptMessageRole.User,
				content: `Active notebook cell: ${this.documentContext.documentUri}\nSelected code:\n\`\`\`\n${context.query}\n\`\`\``,
			});
		} else {
			messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		}
		return messages;
	}

	override getAvailableTools(): IQuizToolInfo[] {
		return [
			{ name: 'quiz_editNotebook', description: 'Edit notebook cells', tags: ['edit'] },
			{ name: 'quiz_createNewJupyterNotebook', description: 'Create a new notebook', tags: ['edit'] },
			{ name: 'quiz_runNotebookCell', description: 'Execute a notebook cell', tags: ['execution'] },
		];
	}

	private _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'You are editing a Jupyter notebook.',
			'You can edit cells, create new cells, and run notebook code.',
			'Provide complete, runnable code cells.',
		].join('\n\n');
	}
}
