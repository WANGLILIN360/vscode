/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Layer: common — contains only the interface and pure-logic helpers.
// Implementation (QuizPromptBuilderImpl) moved to browser/prompt/quizPromptBuilderImpl.ts
// to comply with the four-layer architecture (common/ must not contain DI-injected classes).

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import {
	IQuizBuildPromptContext,
	IQuizBuildPromptResult,
	IQuizBuildPromptProgress,
	IQuizIntentInvocation,
} from '../intents/quizIntents.js';

// #region IQuizPromptBuilder (aligned with Copilot's prompt building via @vscode/prompt-tsx)

/**
 * Builds prompts for the Quiz agent system.
 * Since Quiz is a VS Code Core contribution, it cannot use @vscode/prompt-tsx.
 * Instead, this provides a pure TypeScript prompt construction system with
 * token budgeting, variable injection, and tool schema formatting.
 */
export interface IQuizPromptBuilder {
	/**
	 * Build a complete prompt from the given context and invocation.
	 */
	buildPrompt(
		invocation: IQuizIntentInvocation,
		context: IQuizBuildPromptContext,
		progress: IQuizBuildPromptProgress,
		token: CancellationToken,
	): Promise<IQuizBuildPromptResult>;
}

// #endregion

// #region QuizTokenBudget (aligned with Copilot's token budgeting)

/**
 * Manages token budget for prompt construction.
 * Ensures the prompt stays within the model's context window.
 */
export class QuizTokenBudget {

	constructor(
		public readonly maxTokens: number,
		public readonly reservedOutputTokens: number = 4096,
	) { }

	get availableForPrompt(): number {
		return this.maxTokens - this.reservedOutputTokens;
	}

	/**
	 * Check if a given token count fits within the budget.
	 */
	fits(tokenCount: number): boolean {
		return tokenCount <= this.availableForPrompt;
	}

	/**
	 * Calculate how many tokens remain after the given usage.
	 */
	remaining(usedTokens: number): number {
		return Math.max(0, this.availableForPrompt - usedTokens);
	}
}

// #endregion
