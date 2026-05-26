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

export class QuizTestsIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Tests;
	readonly id = QuizTestsIntent.ID;
	readonly description = 'Tests: generate tests for code';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];
	readonly isListedCapability = true;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizTestsIntent: invoking for location=${invocationContext.location}`);
		if (invocationContext.location === ChatAgentLocation.EditorInline) {
			return this.instantiationService.createInstance(
				QuizTestsInlineIntentInvocation,
				this,
				invocationContext.location,
				invocationContext.endpoint,
				invocationContext.documentContext,
			);
		}
		return this.instantiationService.createInstance(
			QuizTestsPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizTestsPanelIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Generate comprehensive tests for the code.',
			'Include: unit tests, edge cases, and error handling tests.',
			'Use the appropriate testing framework for the language.',
		].join('\n\n');
	}
}

export class QuizTestsInlineIntentInvocation extends QuizGenericInlineIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Generate unit tests for the selected code.',
			'Return only the test code.',
		].join('\n\n');
	}
}

export class QuizSetupTestsIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.SetupTests;
	readonly id = QuizSetupTestsIntent.ID;
	readonly description = 'Setup Tests: configure the workspace for testing';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizSetupTestsIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizSetupTestsIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizSetupTestsIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Set up the workspace for testing.',
			'Install necessary dependencies, configure test runners, and create example tests.',
			'Provide clear instructions for running tests.',
		].join('\n\n');
	}
}
