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
	QuizIntent,
} from '../../common/intents/quizIntents.js';
import { QuizGenericPanelIntentInvocation } from './quizBaseIntentInvocation.js';

export class QuizSearchPanelIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.SearchPanel;
	readonly id = QuizSearchPanelIntent.ID;
	readonly description = 'Search Panel: search code in the workspace';
	readonly locations = [ChatAgentLocation.Chat];
	readonly commandInfo: IQuizIntentSlashCommandInfo = {
		allowsEmptyArgs: false,
		defaultEnablement: true,
		sampleRequest: 'Search for User class in .ts files',
	};

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizSearchPanelIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizGenericPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizSearchKeywordsIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.SearchKeywords;
	readonly id = QuizSearchKeywordsIntent.ID;
	readonly description = 'Search Keywords: search code keywords in the workspace';
	readonly locations = [ChatAgentLocation.Chat];
	readonly commandInfo: IQuizIntentSlashCommandInfo = {
		allowsEmptyArgs: false,
		defaultEnablement: true,
		sampleRequest: 'Search for variables named config',
	};

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizSearchKeywordsIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizGenericPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizSemanticSearchIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.SemanticSearch;
	readonly id = QuizSemanticSearchIntent.ID;
	readonly description = 'Semantic Search: find code by semantic meaning';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizSemanticSearchIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizGenericPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}
