/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Layer: browser — DI-injected implementation of QuizChatTitleProvider.
// Moved from common/ to comply with the four-layer architecture rules.
// The implementation class uses @IQuizEndpointProvider, @ILogService
// DI injections which require the browser layer.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizEndpointProvider } from '../../common/endpoint/quizEndpoint.js';
import {
	IQuizChatTitleProvider,
	IQuizChatTitleContext,
	quizBuildTitlePromptMessages,
	quizPostProcessTitle,
} from '../../common/prompt/quizTitle.js';

export class QuizChatTitleProvider implements IQuizChatTitleProvider {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IQuizEndpointProvider private readonly _endpointProvider: IQuizEndpointProvider,
		@ILogService private readonly _logService: ILogService,
	) { }

	async provideChatTitle(context: IQuizChatTitleContext, token: CancellationToken): Promise<string | undefined> {
		// Find the first user message from history
		const firstRequest = context.history.find(item => item.prompt);
		if (!firstRequest) {
			return '';
		}

		// Get the utility endpoint (aligned with Copilot's 'copilot-utility-small')
		const endpoint = this._endpointProvider.getEndpoint('copilot-utility-small');
		if (!endpoint) {
			this._logService.warn('QuizChatTitleProvider: no endpoint available for title generation');
			return '';
		}

		// Build prompt messages
		const messages = quizBuildTitlePromptMessages(firstRequest.prompt);

		// Send request to LLM
		let fullText = '';
		try {
			const chunks = endpoint.sendChatRequest(messages, { debugName: 'quiz-title' }, token);
			for await (const chunk of chunks) {
				if (token.isCancellationRequested) {
					return '';
				}
				if (chunk.text) {
					fullText += chunk.text;
				}
			}
		} catch (err) {
			this._logService.error(`QuizChatTitleProvider: request failed — ${err}`);
			return '';
		}

		if (token.isCancellationRequested) {
			return '';
		}

		// Post-process the response
		return quizPostProcessTitle(fullText);
	}
}