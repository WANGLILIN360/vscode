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
import { IChatService } from '../../chat/common/chatService/chatService.js';
import { IChatTodoListService } from '../../chat/common/tools/chatTodoListService.js';
import { ICodeMapperService } from '../../chat/common/editing/chatCodeMapperService.js';
import { WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IQuizIntentService, IQuizIntentEndpoint } from '../common/intents/quizIntents.js';
import { IQuizEndpointProvider } from '../common/endpoint/quizEndpoint.js';
import { IQuizFetcherService } from '../common/endpoint/quizFetcher.js';
import { IQuizQAPIClientService } from '../common/endpoint/quizQAPIClient.js';
import { IQuizNetworkService } from '../common/endpoint/quizNetwork.js';
import { IQuizChatTitleProvider } from '../common/prompt/quizTitle.js';
import { IQuizChatQuotaService } from '../common/chat/quizChatTypes.js';
import { IQuizEndpointInfoService } from '../common/quizPlatformServices.js';
import { QuizChatTitleProvider } from './prompt/quizTitleProviderImpl.js';
import { IQuizToolsService } from '../common/tools/quizToolsService.js';
import { QuizIntentServiceImpl } from './intents/quizIntentService.js';
import { registerQuizIntents } from './intents/quizAllIntents.js';
import { registerQuizParticipant } from './quizChatParticipant.contribution.js';
import { QuizEndpointProviderImpl as QuizEndpointProviderImplBrowser } from './endpoint/quizEndpointProviderImpl.js';
import { QuizFetcherServiceImpl } from './endpoint/quizFetcherServiceImpl.js';
import { QuizQAPIClientServiceImpl } from './endpoint/quizQAPIClientServiceImpl.js';
import { QuizNetworkServiceImpl } from './endpoint/quizNetworkServiceImpl.js';
import { QuizChatQuotaServiceImpl } from './chat/quizChatQuotaServiceImpl.js';
import { QuizEndpointInfoServiceImpl } from './endpoint/quizEndpointInfoServiceImpl.js';
import { QuizToolsServiceImpl } from './tools/quizToolsServiceImpl.js';
import { registerQuizBrowserTools } from './tools/quizBrowserToolImpls.js';
import { registerQuizBrowserEditTools } from './tools/quizBrowserEditToolImpls.js';
import { registerQuizBrowserSearchTools } from './tools/quizBrowserSearchToolImpls.js';
import { registerQuizBrowserWorkspaceTools } from './tools/quizBrowserWorkspaceToolImpls.js';
import { registerQuizBrowserTerminalTools } from './tools/quizBrowserTerminalToolImpls.js';
import { registerQuizBrowserVscodeTools } from './tools/quizBrowserVscodeToolImpls.js';
import { registerQuizBrowserSubagentTools } from './tools/quizBrowserSubagentToolImpls.js';
import { registerQuizBrowserNotebookTools } from './tools/quizBrowserNotebookToolImpls.js';
import { registerQuizBrowserSessionStoreTools } from './tools/quizBrowserSessionStoreToolImpls.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { IMarkerService } from '../../../../platform/markers/common/markers.js';
import { ISearchService } from '../../../services/search/common/search.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ISCMService } from '../../scm/common/scm.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { IExtensionManagementService, IExtensionGalleryService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

import { ITerminalService, ITerminalGroupService } from '../../terminal/browser/terminal.js';
import { INotebookService } from '../../notebook/common/notebookService.js';
import { INotebookEditorService } from '../../notebook/browser/services/notebookEditorService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';

// --- Register IntentService as singleton (aligned with Copilot's IntentService registration)

registerSingleton(IQuizIntentService, QuizIntentServiceImpl, InstantiationType.Delayed);
registerSingleton(IQuizEndpointProvider, QuizEndpointProviderImplBrowser, InstantiationType.Delayed);
registerSingleton(IQuizChatTitleProvider, QuizChatTitleProvider, InstantiationType.Delayed);
registerSingleton(IQuizToolsService, QuizToolsServiceImpl, InstantiationType.Delayed);

// --- Register QAPI networking services (aligned with Copilot's dual-path architecture)

registerSingleton(IQuizFetcherService, QuizFetcherServiceImpl, InstantiationType.Delayed);
registerSingleton(IQuizQAPIClientService, QuizQAPIClientServiceImpl, InstantiationType.Delayed);
registerSingleton(IQuizNetworkService, QuizNetworkServiceImpl, InstantiationType.Delayed);

// --- Register quota service (aligned with Copilot's ChatQuotaService)

registerSingleton(IQuizChatQuotaService, QuizChatQuotaServiceImpl, InstantiationType.Delayed);

// --- Register endpoint info service (aligned with Copilot's IChatEndpoint read-only subset)

registerSingleton(IQuizEndpointInfoService, QuizEndpointInfoServiceImpl, InstantiationType.Delayed);

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
		@ISCMService scmService: ISCMService,
		@IRequestService requestService: IRequestService,
		@IExtensionManagementService extensionManagementService: IExtensionManagementService,
		@IExtensionGalleryService extensionGalleryService: IExtensionGalleryService,
		@ICommandService commandService: ICommandService,
		@ITerminalService terminalService: ITerminalService,
		@ITerminalGroupService terminalGroupService: ITerminalGroupService,
		@INotebookService notebookService: INotebookService,
		@INotebookEditorService notebookEditorService: INotebookEditorService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@IQuizToolsService toolsService: IQuizToolsService,
		@IChatService chatService: IChatService,
		@IChatTodoListService chatTodoListService: IChatTodoListService,
		@ICodeMapperService codeMapperService: ICodeMapperService,
	) {
		super();

		logService.info('QuizContribution: registering Quiz participant and intents');

		// Register browser-layer tool implementations (override common-layer stubs)
		registerQuizBrowserTools(fileService, searchService, workspaceContextService);
		registerQuizBrowserEditTools(textFileService, fileService, chatService, codeMapperService, notebookService);
		registerQuizBrowserSearchTools(searchService, workspaceContextService);
		registerQuizBrowserWorkspaceTools(fileService, markerService, searchService, workspaceContextService, scmService, requestService, extensionManagementService, extensionGalleryService, commandService, undefined /* memoryCleanupService — TODO: wire via DI */);
		registerQuizBrowserTerminalTools(terminalService, terminalGroupService, workspaceContextService, logService);
		registerQuizBrowserVscodeTools(commandService, toolsService, chatTodoListService, chatService, logService);
		registerQuizBrowserSubagentTools(chatAgentService, chatService, logService, searchService, workspaceContextService, fileService);
		registerQuizBrowserNotebookTools(notebookEditorService, fileService);
		registerQuizBrowserSessionStoreTools(uriIdentityService, chatService, logService);

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
