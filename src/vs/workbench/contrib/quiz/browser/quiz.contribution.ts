/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IChatAgentService } from '../../chat/common/participants/chatAgents.js';
import { WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IQuizIntentService, IQuizIntentEndpoint } from '../common/intents/quizIntents.js';
import { IQuizEndpointProvider } from '../common/endpoint/quizEndpoint.js';
import { IQuizChatTitleProvider, QuizChatTitleProvider } from '../common/prompt/quizTitle.js';
import { IQuizToolsService } from '../common/tools/quizToolsService.js';
import { QuizIntentServiceImpl } from './intents/quizIntentService.js';
import { registerQuizIntents } from './intents/quizAllIntents.js';
import { registerQuizParticipant } from './quizChatParticipant.contribution.js';
import { QuizEndpointProviderImpl as QuizEndpointProviderImplBrowser } from './endpoint/quizEndpointProviderImpl.js';
import { QuizToolsServiceImpl } from './tools/quizToolsServiceImpl.js';
import { registerQuizBrowserTools } from './tools/quizBrowserToolImpls.js';
import { registerQuizBrowserEditTools } from './tools/quizBrowserEditToolImpls.js';
import { registerQuizBrowserSearchTools } from './tools/quizBrowserSearchToolImpls.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IMarkerService } from '../../../../platform/markers/common/markers.js';
import { ISearchService } from '../../../services/search/common/search.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

// --- Register IntentService as singleton (aligned with Copilot's IntentService registration)

registerSingleton(IQuizIntentService, QuizIntentServiceImpl, InstantiationType.Delayed);
registerSingleton(IQuizEndpointProvider, QuizEndpointProviderImplBrowser, InstantiationType.Delayed);
registerSingleton(IQuizChatTitleProvider, QuizChatTitleProvider, InstantiationType.Delayed);
registerSingleton(IQuizToolsService, QuizToolsServiceImpl, InstantiationType.Delayed);

// --- Quiz contribution (registers the Quiz chat participant + intents)

export class QuizContribution extends Disposable {

	static readonly ID = 'workbench.contrib.quiz';

	private readonly _endpoint = observableValue<IQuizIntentEndpoint | undefined>('quizEndpoint', undefined);

	constructor(
		@IChatAgentService chatAgentService: IChatAgentService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IQuizIntentService intentService: IQuizIntentService,
		@IQuizEndpointProvider endpointProvider: IQuizEndpointProvider,
		@IFileService fileService: IFileService,
		@ITextFileService textFileService: ITextFileService,
		@IMarkerService markerService: IMarkerService,
		@ISearchService searchService: ISearchService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ILogService logService: ILogService,
	) {
		super();

		logService.info('QuizContribution: registering Quiz participant and intents');

		// Register browser-layer tool implementations (override common-layer stubs)
		registerQuizBrowserTools(fileService, markerService, searchService, workspaceContextService);
		registerQuizBrowserEditTools(textFileService, fileService);
		registerQuizBrowserSearchTools(searchService, workspaceContextService);

		// Register all intents
		registerQuizIntents(intentService, instantiationService);

		// Resolve real endpoint from IQuizEndpointProvider
		(endpointProvider as import('./endpoint/quizEndpointProviderImpl.js').QuizEndpointProviderImpl)
			.getIntentEndpoint()
			.then(endpoint => {
				if (endpoint) {
					this._endpoint.set(endpoint, undefined);
					logService.info(`QuizContribution: resolved endpoint model=${endpoint.model}, family=${endpoint.family}`);
				} else {
					logService.warn('QuizContribution: no endpoint available, using fallback');
					this._endpoint.set({
						model: 'copilot-gpt-4o',
						family: 'gpt-4o',
						vendor: 'copilot',
						supportsToolCalls: true,
						maxOutputTokens: 4096,
						maxInputTokens: 128000,
						name: 'GPT-4o',
						identityName: 'Quiz',
					}, undefined);
				}
			})
			.catch(err => logService.error(`QuizContribution: endpoint resolution failed: ${String(err)}`));

		// Register participant with observable endpoint
		this._register(registerQuizParticipant(chatAgentService, instantiationService, this._endpoint));
	}
}

// --- Register the contribution

registerWorkbenchContribution2(QuizContribution.ID, QuizContribution, WorkbenchPhase.AfterRestored);
