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
	QuizIntent,
} from '../../common/intents/quizIntents.js';
import { QuizGenericPanelIntentInvocation, QuizGenericInlineIntentInvocation } from './quizBaseIntentInvocation.js';

export class QuizExplainIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Explain;
	readonly id = QuizExplainIntent.ID;
	readonly description = 'Explain: explain code or how to do something';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];
	readonly isListedCapability = true;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizExplainIntent: invoking for location=${invocationContext.location}`);
		if (invocationContext.location === ChatAgentLocation.EditorInline) {
			return this.instantiationService.createInstance(
				QuizExplainInlineIntentInvocation,
				this,
				invocationContext.location,
				invocationContext.endpoint,
				invocationContext.documentContext,
			);
		}
		return this.instantiationService.createInstance(
			QuizExplainPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizExplainPanelIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Explain code or concepts clearly and concisely.',
			'Use code blocks for code examples. Explain the "why" behind code, not just the "what".',
		].join('\n\n');
	}
}

export class QuizExplainInlineIntentInvocation extends QuizGenericInlineIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Explain the selected code briefly. Focus on key concepts.',
		].join('\n\n');
	}
}
