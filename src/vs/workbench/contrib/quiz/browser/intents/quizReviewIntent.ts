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

export class QuizReviewIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Review;
	readonly id = QuizReviewIntent.ID;
	readonly description = 'Review: review selected code or changes';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];
	readonly isListedCapability = true;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizReviewIntent: invoking for location=${invocationContext.location}`);
		if (invocationContext.location === ChatAgentLocation.EditorInline) {
			return this.instantiationService.createInstance(
				QuizReviewInlineIntentInvocation,
				this,
				invocationContext.location,
				invocationContext.endpoint,
				invocationContext.documentContext,
			);
		}
		return this.instantiationService.createInstance(
			QuizReviewPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizReviewPanelIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Review code thoroughly and provide actionable feedback.',
			'Focus on: bugs, security issues, performance, code style, and best practices.',
			'Suggest specific improvements with examples.',
		].join('\n\n');
	}
}

export class QuizReviewInlineIntentInvocation extends QuizGenericInlineIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Review the selected code briefly.',
			'Mention critical issues first. Be concise.',
		].join('\n\n');
	}
}
