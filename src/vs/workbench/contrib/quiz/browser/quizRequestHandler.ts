/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IChatAgentHistoryEntry, IChatAgentRequest, IChatAgentResult } from '../../chat/common/participants/chatAgents.js';
import { IQuizBuildPromptContext, IQuizIntent, IQuizIntentInvocationContext, IQuizIntentEndpoint } from '../common/intents/quizIntents.js';
import { IQuizEndpointProvider } from '../common/endpoint/quizEndpoint.js';
import { IQuizToolsService } from '../common/tools/quizToolsService.js';
import { QuizConversation, QuizTurnImpl } from '../common/prompt/quizConversation.js';
import { QuizDefaultToolCallingLoop } from '../common/prompt/quizToolCallingLoop.js';
import { IQuizChatHookService } from '../common/prompt/quizHookService.js';
import { IQuizSessionTranscriptService } from '../common/prompt/quizSessionTranscript.js';

// --- Request handler (aligned with Copilot's DefaultIntentRequestHandler)

export class QuizRequestHandler extends Disposable {

	private readonly _conversation: QuizConversation;

	constructor(
		private readonly _request: IChatAgentRequest,
		private readonly _history: readonly IChatAgentHistoryEntry[],
		private readonly _token: CancellationToken,
		private readonly _intent: IQuizIntent,
		private readonly _intentEndpoint: IQuizIntentEndpoint,
		@IQuizEndpointProvider private readonly _endpointProvider: IQuizEndpointProvider,
		@IQuizToolsService private readonly _toolsService: IQuizToolsService,
		@ILogService private readonly _logService: ILogService,
		@IQuizChatHookService private readonly _hookService: IQuizChatHookService,
		@IQuizSessionTranscriptService private readonly _transcriptService: IQuizSessionTranscriptService,
	) {
		super();
		this._conversation = new QuizConversation(this._request.sessionResource.toString());
	}

	async getResult(): Promise<IChatAgentResult> {
		this._logService.info(`QuizRequestHandler: handling request for intent ${this._intent.id}`);

		// Create turn from request
		const turn = QuizTurnImpl.fromAgentRequest(this._request.requestId, this._request);
		this._conversation.addTurn(turn);

		// Invoke intent to get invocation
		const invocationContext: IQuizIntentInvocationContext = {
			location: this._request.location,
			request: this._request,
			endpoint: this._intentEndpoint,
		};
		const invocation = await this._intent.invoke(invocationContext);

		// Build conversation from history + current turn
		const conversation = QuizConversation.fromHistory(
			this._conversation.sessionId,
			this._history.map(h => h.request),
			turn,
		);

		// Get a real endpoint from the provider
		const endpoint = this._endpointProvider.getEndpoint(this._intentEndpoint.model);
		if (!endpoint) {
			this._logService.error('[QuizRequestHandler] No endpoint available for model:', this._intentEndpoint.model);
			return { metadata: {} };
		}

		// Run tool calling loop
		const loop = new QuizDefaultToolCallingLoop(
			invocation,
			{ toolCallLimit: 25, endpoint, conversation, chatSessionId: this._conversation.sessionId, requestId: this._request.requestId },
			this._toolsService,
			this._logService,
			this._hookService,
			this._transcriptService,
		);

		const buildPromptContext: IQuizBuildPromptContext = {
			requestId: this._request.requestId,
			query: this._request.message,
			history: conversation.turns.slice(0, -1), // Exclude current turn from history
			request: this._request,
			conversation,
		};

		const result = await loop.run(
			buildPromptContext,
			message => this._logService.trace(`QuizToolCallingLoop progress: ${typeof message === 'string' ? message : 'progress part'}`),
			this._token,
		);

		// Map IQuizChatResult to IChatAgentResult
		return {
			metadata: result.metadata ?? {},
			errorDetails: result.errorDetails ? {
				message: result.errorDetails.message,
				responseIsIncomplete: result.errorDetails.responseIsIncomplete,
				responseIsFiltered: result.errorDetails.responseIsFiltered,
			} : undefined,
		};
	}
}
