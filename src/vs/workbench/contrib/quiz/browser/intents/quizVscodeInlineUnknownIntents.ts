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

export class QuizVscodeIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Vscode;
	readonly id = QuizVscodeIntent.ID;
	readonly description = 'VS Code: answer questions about VS Code';
	readonly locations = [ChatAgentLocation.Chat];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizVscodeIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizVscodeIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}

export class QuizVscodeIntentInvocation extends QuizGenericPanelIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'You are a VS Code expert. Answer questions about VS Code features, settings, and extensions.',
			'Provide specific commands and settings when relevant.',
			'For settings, provide the setting ID and example values.',
		].join('\n\n');
	}
}

export class QuizInlineChatIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.InlineChat;
	readonly id = QuizInlineChatIntent.ID;
	readonly description = 'Inline Chat: quick edits in the editor';
	readonly locations = [ChatAgentLocation.EditorInline];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizInlineChatIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizInlineChatIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
			invocationContext.documentContext,
		);
	}
}

export class QuizInlineChatIntentInvocation extends QuizGenericInlineIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Make quick edits to the selected code.',
			'Return only the replacement code.',
			'Be concise and focused.',
		].join('\n\n');
	}
}

export class QuizEditorIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Editor;
	readonly id = QuizEditorIntent.ID;
	readonly description = 'Editor: general editor assistance';
	readonly locations = [ChatAgentLocation.EditorInline];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizEditorIntent: invoking for location=${invocationContext.location}`);
		return this.instantiationService.createInstance(
			QuizEditorIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
			invocationContext.documentContext,
		);
	}
}

export class QuizEditorIntentInvocation extends QuizGenericInlineIntentInvocation {

	protected override _buildSystemPrompt(): string {
		return [
			`You are an AI programming assistant named ${this.endpoint.identityName}.`,
			`You are powered by ${this.endpoint.name} (${this.endpoint.model}).`,
			'Assist with general editor tasks in the selected code.',
			'Provide code improvements, explanations, or transformations.',
		].join('\n\n');
	}
}

export class QuizUnknownIntent implements IQuizIntent {

	static readonly ID: QuizIntent = QuizIntent.Unknown;
	readonly id = QuizUnknownIntent.ID;
	readonly description = 'Unknown: fallback when intent is unclear';
	readonly locations = [ChatAgentLocation.Chat, ChatAgentLocation.EditorInline];

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
	) { }

	async invoke(invocationContext: IQuizIntentInvocationContext): Promise<IQuizIntentInvocation> {
		this.logService.info(`QuizUnknownIntent: invoking for location=${invocationContext.location}`);
		if (invocationContext.location === ChatAgentLocation.EditorInline) {
			return this.instantiationService.createInstance(
				QuizGenericInlineIntentInvocation,
				this,
				invocationContext.location,
				invocationContext.endpoint,
				invocationContext.documentContext,
			);
		}
		return this.instantiationService.createInstance(
			QuizGenericPanelIntentInvocation,
			this,
			invocationContext.location,
			invocationContext.endpoint,
		);
	}
}
