/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizBuildPromptContext,
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

export class QuizNewWorkspaceIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.New;
	readonly id = QuizNewWorkspaceIntent.ID;
	readonly description = 'New: scaffold new files or projects';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizNewWorkspaceIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizNewWorkspaceIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizNewWorkspaceIntentInvocation extends QuizRendererIntentInvocationImpl {

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
		messages.push({ role: QuizPromptMessageRole.User, content: context.query });
		return messages;
	}

	override getAvailableTools(): IQuizToolInfo[] {
		return [
			{ name: 'quiz_createFile', description: 'Create a new file', tags: ['edit'] },
			{ name: 'quiz_listDirectory', description: 'List directory contents', tags: ['read'] },
		];
	}

	private _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Create new files or project scaffolding.',
			'Generate complete, production-ready code.',
			'Suggest file structures and naming conventions.',
		].join('\n\n');
	}
}
