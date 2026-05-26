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
	QuizEditStrategy,
	QuizIntent,
} from '../../common/intents/quizIntents.js';
import { QuizGenericPanelIntentInvocation, QuizGenericInlineIntentInvocation } from './quizBaseIntentInvocation.js';

export class QuizGenerateCodeIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Generate;
	readonly id = QuizGenerateCodeIntent.ID;
	readonly description = 'Generate: generate new code';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];
	readonly isListedCapability = true;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizGenerateCodeIntent: invoking for location=${invocationContext.location}`);
		if (invocationContext.location === ChatAgentLocation.EditorInline) {
			return this.instantiationService.createInstance(
				QuizGenerateCodeInlineIntentInvocation,
				this,
				invocationContext.location,
				invocationContext.endpoint,
				invocationContext.documentContext,
			);
		}
		return this.instantiationService.createInstance(
			QuizGenerateCodePanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizGenerateCodePanelIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Generate code based on the user\'s requirements.',
			'Provide complete, working code with comments.',
		].join('\n\n');
	}
}

export class QuizGenerateCodeInlineIntentInvocation extends QuizGenericInlineIntentInvocation {

	override readonly editStrategy = QuizEditStrategy.ForceInsertion;

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Generate code at the cursor position.',
			'Return only the code to insert.',
		].join('\n\n');
	}
}
