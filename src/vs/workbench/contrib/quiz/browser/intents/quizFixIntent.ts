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
	IQuizToolInfo,
	QuizIntent,
} from '../../common/intents/quizIntents.js';
import { QuizGenericPanelIntentInvocation, QuizGenericInlineIntentInvocation } from './quizBaseIntentInvocation.js';

export class QuizFixIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Fix;
	readonly id = QuizFixIntent.ID;
	readonly description = 'Fix: propose fixes for problems in code';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];
	readonly isListedCapability = true;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizFixIntent: invoking for location=${invocationContext.location}`);
		if (invocationContext.location === ChatAgentLocation.EditorInline) {
			return this.instantiationService.createInstance(
				QuizFixInlineIntentInvocation,
				this,
				invocationContext.location,
				invocationContext.endpoint,
				invocationContext.documentContext,
			);
		}
		return this.instantiationService.createInstance(
			QuizFixPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizFixPanelIntentInvocation extends QuizGenericPanelIntentInvocation {

	override getAvailableTools(): IQuizToolInfo[] {
		return [
			{ name: 'quiz_getErrors', description: 'Get diagnostics/errors for a file', tags: ['diagnostics'] },
			{ name: 'quiz_readFile', description: 'Read file contents', tags: ['read'] },
		];
	}

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Analyze the code for issues and provide fixes.',
			'Use available tools to get diagnostics and read files.',
			'Explain the issue and provide the fix.',
		].join('\n\n');
	}
}

export class QuizFixInlineIntentInvocation extends QuizGenericInlineIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Fix the selected code. Return only the corrected code.',
			'Do not include explanations.',
		].join('\n\n');
	}
}
