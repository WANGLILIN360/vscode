/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/title.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizEndpointProvider } from '../endpoint/quizEndpoint.js';
import { IQuizPromptMessage, QuizPromptMessageRole } from '../intents/quizIntents.js';

export const IQuizChatTitleProvider = createDecorator<IQuizChatTitleProvider>('quizChatTitleProvider');

/**
 * Provides auto-generated titles for chat sessions.
 * Aligned with Copilot's ChatTitleProvider (vscode.ChatTitleProvider).
 */
export interface IQuizChatTitleProvider {
	readonly _serviceBrand: undefined;

	/**
	 * Generate a title for a chat session based on the first user message.
	 */
	provideChatTitle(
		context: IQuizChatTitleContext,
		token: CancellationToken,
	): Promise<string | undefined>;
}

export interface IQuizChatTitleContext {
	readonly history: readonly IQuizChatHistoryItem[];
	readonly sessionResource?: unknown;
}

export interface IQuizChatHistoryItem {
	readonly prompt: string;
	readonly command?: string;
}

// #region Title prompt template (aligned with Copilot's TitlePrompt from prompts/node/panel/title.tsx)

/**
 * Builds the prompt messages for title generation.
 * Pure TypeScript implementation — cannot use @vscode/prompt-tsx in Core.
 */
export function quizBuildTitlePromptMessages(userRequest: string): IQuizPromptMessage[] {
	const systemContent = [
		'You are an expert in crafting ultra-compact titles for chatbot conversations. You are presented with a chat request, and you reply with only a brief title that captures the main topic of that request.',
		// SafetyRules (aligned with Copilot's SafetyRules)
		'Follow Microsoft content policies.',
		'Avoid content that violates copyrights.',
		'If you are asked to generate content that is harmful, hateful, racist, sexist, lewd, or violent, only respond with "Sorry, I can\'t assist with that."',
		'Keep your answers short and impersonal.',
		// Title formatting rules
		'Write the title in sentence case, not title case. Preserve product names, abbreviations, code symbols, and proper nouns.',
		'Aim for 3-6 words. Prefer the shortest accurate title.',
		'Drop articles like "a", "an", and "the" unless needed for clarity.',
		'Drop filler and generic framing like "help with", "question about", "request for", or "issue with".',
		'Prefer short, concrete synonyms and omit unnecessary words.',
		'Do not wrap the title in quotes or add trailing punctuation.',
		'Here are some examples of good titles:',
		'- Git rebase question',
		'- Install Python packages',
		'- LinkedList implementation location',
		'- Add VS Code tree view',
		'- React useState usage',
	].join('\n');

	const userContent = [
		'Please write a brief title for the following request:',
		'',
		userRequest,
	].join('\n');

	return [
		{ role: QuizPromptMessageRole.System, content: systemContent },
		{ role: QuizPromptMessageRole.User, content: userContent },
	];
}

// #endregion

// #region Title post-processing (aligned with Copilot's title response handling)

/**
 * Post-processes the raw title response from the LLM.
 * - Trims whitespace
 * - Strips surrounding quotes
 * - Returns undefined for refusal responses
 */
export function quizPostProcessTitle(rawTitle: string): string | undefined {
	let title = rawTitle.trim();

	// Strip surrounding quotes (e.g. "Git rebase question" → Git rebase question)
	if (title.match(/^".*"$/)) {
		title = title.slice(1, -1);
	}

	// If the model refused to assist, return undefined
	if (title.includes('can\'t assist with that')) {
		return undefined;
	}

	return title;
}

// #endregion

// #region Real implementation (aligned with Copilot's ChatTitleProvider)

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

// #endregion

// #region Null implementation

/**
 * Null implementation that returns undefined.
 */
export class NullQuizChatTitleProvider implements IQuizChatTitleProvider {
	declare readonly _serviceBrand: undefined;

	async provideChatTitle(_context: IQuizChatTitleContext, _token: CancellationToken): Promise<string | undefined> {
		return undefined;
	}
}

// #endregion
