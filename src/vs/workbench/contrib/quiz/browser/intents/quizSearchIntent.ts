/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import {
	IQuizIntent,
	IQuizIntentInvocation,
	IQuizIntentInvocationContext,
	IQuizIntentSlashCommandInfo,
	IQuizPromptMessage,
	IQuizBuildPromptContext,
	IQuizIntentEndpoint,
	QuizIntent,
	QuizPromptMessageRole,
} from '../../common/intents/quizIntents.js';
import { QuizRendererIntentInvocationImpl } from './quizBaseIntentInvocation.js';

export class QuizSearchIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Search;
	readonly id = QuizSearchIntent.ID;
	readonly description = 'Search: generate query parameters for workspace search';
	readonly locations = [ChatAgentLocation.Chat];
	readonly commandInfo: IQuizIntentSlashCommandInfo = {
		allowsEmptyArgs: false,
		defaultEnablement: true,
		sampleRequest: 'Find all usages of the User class',
	};

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizSearchIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizSearchIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizSearchIntentInvocation extends QuizRendererIntentInvocationImpl {

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

	private _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Generate VS Code search query parameters for the user\'s request.',
			'Respond with a JSON object containing: query, include, exclude, matchCase, matchWholeWord.',
		].join('\n\n');
	}
}
