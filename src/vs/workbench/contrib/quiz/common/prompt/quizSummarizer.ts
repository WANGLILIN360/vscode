/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/summarizer.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizTurn } from '../intents/quizIntents.js';

export const IQuizChatSummarizerProvider = createDecorator<IQuizChatSummarizerProvider>('quizChatSummarizerProvider');

/**
 * Provides conversation summarization for chat sessions.
 * Aligned with Copilot's ChatSummarizerProvider (vscode.ChatSummarizer).
 */
export interface IQuizChatSummarizerProvider {
	readonly _serviceBrand: undefined;

	/**
	 * Generate a summary of the conversation history.
	 * Aligned with Copilot's ChatSummarizerProvider.provideChatSummary.
	 */
	provideChatSummary(
		context: IQuizChatSummaryContext,
		token: CancellationToken,
	): Promise<string>;
}

/**
 * Context for generating a conversation summary.
 * Aligned with Copilot's ChatContext (used in summarizer.ts).
 */
export interface IQuizChatSummaryContext {
	/** The conversation turns to summarize */
	readonly history: readonly IQuizTurn[];
	/** The session resource URI for the conversation */
	readonly sessionResource?: URI;
	/** The chat session ID */
	readonly chatSessionId?: string;
}

/**
 * Null implementation that returns empty string.
 */
export class NullQuizChatSummarizerProvider implements IQuizChatSummarizerProvider {
	declare readonly _serviceBrand: undefined;

	async provideChatSummary(_context: IQuizChatSummaryContext, _token: CancellationToken): Promise<string> {
		return '';
	}
}
