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
import { QuizGenericPanelIntentInvocation } from './quizBaseIntentInvocation.js';

export class QuizTerminalIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Terminal;
	readonly id = QuizTerminalIntent.ID;
	readonly description = 'Terminal: ask how to do something in the terminal';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.Terminal];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizTerminalIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizTerminalIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizTerminalIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Provide terminal commands and shell scripting help.',
			'Include OS-specific commands when relevant.',
			'Explain what each command does.',
		].join('\n\n');
	}
}

export class QuizTerminalExplainIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.TerminalExplain;
	readonly id = QuizTerminalExplainIntent.ID;
	readonly description = 'Terminal Explain: explain terminal output or commands';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.Terminal];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizTerminalExplainIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizTerminalExplainIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizTerminalExplainIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Explain terminal output and shell commands.',
			'Break down complex commands and explain their effects.',
			'Highlight potential issues or security concerns.',
		].join('\n\n');
	}
}
