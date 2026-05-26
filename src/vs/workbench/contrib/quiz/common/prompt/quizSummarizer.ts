/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/summarizer.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizChatSummarizerProvider = createDecorator<IQuizChatSummarizerProvider>('quizChatSummarizerProvider');

/**
 * Provides conversation summarization for chat sessions.
 * Aligned with Copilot's ChatSummarizerProvider (vscode.ChatSummarizer).
 */
export interface IQuizChatSummarizerProvider {
	readonly _serviceBrand: undefined;

	/**
	 * Generate a summary of the conversation history.
	 */
	provideChatSummary(
		context: IQuizChatSummaryContext,
		token: CancellationToken,
	): Promise<string>;
}

export interface IQuizChatSummaryContext {
	readonly history: readonly unknown[];
	readonly sessionResource?: unknown;
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
