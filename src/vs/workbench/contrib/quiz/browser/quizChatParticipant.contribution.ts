/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IObservable } from '../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { IChatAgentHistoryEntry, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentService } from '../../chat/common/participants/chatAgents.js';
import { IChatProgress } from '../../chat/common/chatService/chatService.js';
import { ChatAgentLocation, ChatModeKind } from '../../chat/common/constants.js';
import { IQuizIntentEndpoint, IQuizIntentService, QuizIntent } from '../common/intents/quizIntents.js';
import { IQuizChatTitleProvider, IQuizChatHistoryItem } from '../common/prompt/quizTitle.js';
import { QuizRequestHandler } from './quizRequestHandler.js';

// --- Quiz participant constants

export const QUIZ_PARTICIPANT_ID = 'quiz.chat';
export const QUIZ_PARTICIPANT_NAME = 'quiz';

// --- Quiz agent implementation (aligned with Copilot's ChatAgents pattern)

export class QuizAgentImplementation extends Disposable implements IChatAgentImplementation {

	constructor(
		private readonly _endpointObs: IObservable<IQuizIntentEndpoint | undefined>,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IQuizIntentService private readonly _intentService: IQuizIntentService,
		@IQuizChatTitleProvider private readonly _titleProvider: IQuizChatTitleProvider,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	async invoke(
		request: IChatAgentRequest,
		progress: (parts: IChatProgress[]) => void,
		history: IChatAgentHistoryEntry[],
		token: CancellationToken,
	): Promise<IChatAgentResult> {
		this._logService.info(`QuizAgent: invoke for request ${request.requestId}`);

		// Resolve intent from request command or default to Ask
		const intentId = this._resolveIntentFromRequest(request);
		const intent = this._intentService.getIntent(intentId, request.location);

		if (!intent) {
			this._logService.warn(`QuizAgent: no intent found for id=${intentId}, location=${request.location}`);
			return { metadata: {} };
		}

		// Read current endpoint value from observable
		const endpoint = this._endpointObs.get();
		if (!endpoint) {
			this._logService.warn('QuizAgent: no endpoint available yet');
			return { metadata: {} };
		}

		// Create request handler and run
		const handler = this._instantiationService.createInstance(
			QuizRequestHandler,
			request,
			history,
			token,
			intent,
			endpoint,
		);

		return handler.getResult();
	}

	async provideChatTitle(history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<string | undefined> {
		const quizHistory: IQuizChatHistoryItem[] = history
			.filter(entry => entry.request.message)
			.map(entry => ({
				prompt: entry.request.message,
				command: entry.request.command,
			}));

		return this._titleProvider.provideChatTitle(
			{ history: quizHistory },
			token,
		);
	}

	private _resolveIntentFromRequest(request: IChatAgentRequest): string {
		// Resolve intent from slash command, or default to Ask
		// TODO: integrate with ChatModeKind when mode is available on IChatAgentRequest
		switch (request.command) {
			case 'agent':
				return QuizIntent.Agent;
			case 'edit':
				return QuizIntent.Edit;
			case 'explore':
				return QuizIntent.SearchPanel;
			default:
				return QuizIntent.AskAgent;
		}
	}
}

// --- Registration helper (aligned with Copilot's doRegisterAgent + SetupAgent pattern)

export function registerQuizParticipant(
	chatAgentService: IChatAgentService,
	instantiationService: IInstantiationService,
	endpointObs: IObservable<IQuizIntentEndpoint | undefined>,
): IDisposable {
	const disposables = new DisposableStore();

	// Register agent data (isCore: true, like SetupAgent)
	disposables.add(chatAgentService.registerAgent(QUIZ_PARTICIPANT_ID, {
		id: QUIZ_PARTICIPANT_ID,
		name: QUIZ_PARTICIPANT_NAME,
		isDefault: true,
		isCore: true,
		modes: [ChatModeKind.Agent, ChatModeKind.Ask, ChatModeKind.Edit],
		slashCommands: [],
		disambiguation: [],
		locations: [ChatAgentLocation.Chat],
		metadata: {
			helpTextPrefix: localize('quizHelpPrefix', "I'm Quiz, an AI assistant integrated into VS Code."),
		},
		description: localize('quizAgentDescription', "Ask questions about your code and workspace"),
		extensionId: nullExtensionDescription.identifier,
		extensionVersion: undefined,
		extensionDisplayName: nullExtensionDescription.name,
		extensionPublisherId: nullExtensionDescription.publisher,
	}));

	// Register agent implementation
	const agent = disposables.add(instantiationService.createInstance(QuizAgentImplementation, endpointObs));
	disposables.add(chatAgentService.registerAgentImplementation(QUIZ_PARTICIPANT_ID, agent));

	// Update icon
	chatAgentService.updateAgent(QUIZ_PARTICIPANT_ID, { themeIcon: Codicon.sparkle });

	return disposables;
}
