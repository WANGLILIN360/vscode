/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IQuizTokenizer, IQuizTokenBudget, IQuizTokenUsage, QuizTokenizerType } from '../quizTypes.js';
import { IQuizPromptMessage } from '../intents/quizIntents.js';

// #region QuizTokenizerImpl (aligned with Copilot's ITokenizer)

/**
 * Character-level tokenizer implementation.
 * Uses ~4 chars/token approximation, aligned with Copilot's fallback estimation.
 * For production use, the ILanguageModelsService.computeTokenLength provides
 * the real tokenizer (O200K/CL100K) via the endpoint.
 */
export class QuizCharLevelTokenizer implements IQuizTokenizer {

	readonly type = QuizTokenizerType.CharLevel;

	private static readonly CHARS_PER_TOKEN = 4;

	countTokens(text: string, _token: CancellationToken): Promise<number> {
		return Promise.resolve(this.estimateTokens(text));
	}

	estimateTokens(text: string): number {
		return Math.ceil(text.length / QuizCharLevelTokenizer.CHARS_PER_TOKEN);
	}
}

/**
 * Tokenizer that delegates to ILanguageModelsService for real token counting.
 * Falls back to char-level estimation when the service is unavailable.
 */
export class QuizServiceTokenizer extends Disposable implements IQuizTokenizer {

	readonly type: QuizTokenizerType;

	constructor(
		private readonly _computeTokenLength: (text: string, token: CancellationToken) => Promise<number>,
		private readonly _tokenizerType: QuizTokenizerType = QuizTokenizerType.O200K,
	) {
		super();
		this.type = _tokenizerType;
	}

	async countTokens(text: string, token: CancellationToken): Promise<number> {
		try {
			return await this._computeTokenLength(text, token);
		} catch {
			return new QuizCharLevelTokenizer().estimateTokens(text);
		}
	}

	estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}
}

// #endregion

// #region QuizTokenBudgetImpl (aligned with Copilot's token budget management)

/**
 * Mutable token budget tracker for a request.
 * Aligned with Copilot's token budget management — tracks prompt and output
 * token allocation, remaining capacity, and provides budget-aware pruning hints.
 */
export class QuizTokenBudgetImpl implements IQuizTokenBudget {

	private _usedPromptTokens: number;

	constructor(
		public readonly maxPromptTokens: number,
		public readonly maxOutputTokens: number,
		public readonly reservedOutputTokens: number,
		initialUsedPromptTokens: number = 0,
	) {
		this._usedPromptTokens = initialUsedPromptTokens;
	}

	get usedPromptTokens(): number {
		return this._usedPromptTokens;
	}

	get remainingPromptTokens(): number {
		return Math.max(0, this.maxPromptTokens - this._usedPromptTokens);
	}

	/**
	 * Record that some prompt tokens have been used.
	 */
	usePromptTokens(count: number): void {
		this._usedPromptTokens += count;
	}

	/**
	 * Check if there is room for the given number of additional prompt tokens.
	 */
	hasRoomFor(count: number): boolean {
		return this.remainingPromptTokens >= count;
	}

	/**
	 * Get the fraction of prompt budget remaining (0 to 1).
	 */
	get remainingFraction(): number {
		return this.maxPromptTokens > 0 ? this.remainingPromptTokens / this.maxPromptTokens : 0;
	}

	/**
	 * Create a budget from an endpoint's token limits.
	 */
	static fromEndpoint(
		maxPromptTokens: number,
		maxOutputTokens: number,
		reservedOutputTokens: number = 0,
	): QuizTokenBudgetImpl {
		return new QuizTokenBudgetImpl(maxPromptTokens, maxOutputTokens, reservedOutputTokens);
	}
}

// #endregion

// #region QuizTokenCounter (aligned with Copilot's token counting utilities)

/**
 * Utility for counting tokens across prompt messages.
 * Aligned with Copilot's ITokenizer.countMessagesTokens / countToolTokens.
 */
export class QuizTokenCounter {

	constructor(
		private readonly _tokenizer: IQuizTokenizer,
	) { }

	/**
	 * Count tokens for a single prompt message.
	 */
	async countMessageTokens(message: IQuizPromptMessage, token: CancellationToken): Promise<number> {
		let total = 0;
		// Role overhead (~4 tokens per message for role markers)
		total += 4;
		if (typeof message.content === 'string') {
			total += await this._tokenizer.countTokens(message.content, token);
		} else if (message.content) {
			total += await this._tokenizer.countTokens(JSON.stringify(message.content), token);
		}
		if (message.toolCalls) {
			for (const tc of message.toolCalls) {
				total += await this._tokenizer.countTokens(tc.name, token);
				total += await this._tokenizer.countTokens(typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments), token);
			}
		}
		if (message.toolCallId) {
			total += await this._tokenizer.countTokens(message.toolCallId, token);
		}
		if (message.toolName) {
			total += await this._tokenizer.countTokens(message.toolName, token);
		}
		return total;
	}

	/**
	 * Count tokens across all messages in a prompt.
	 */
	async countMessagesTokens(messages: readonly IQuizPromptMessage[], token: CancellationToken): Promise<number> {
		let total = 0;
		for (const message of messages) {
			total += await this.countMessageTokens(message, token);
		}
		// Priming tokens (conversation template overhead)
		total += 3;
		return total;
	}

	/**
	 * Count tokens for tool definitions.
	 * Aligned with Copilot's ITokenizer.countToolTokens.
	 */
	async countToolTokens(tools: readonly { name: string; description?: string; parameters?: object }[], token: CancellationToken): Promise<number> {
		let total = 0;
		for (const tool of tools) {
			total += await this._tokenizer.countTokens(tool.name, token);
			if (tool.description) {
				total += await this._tokenizer.countTokens(tool.description, token);
			}
			if (tool.parameters) {
				total += await this._tokenizer.countTokens(JSON.stringify(tool.parameters), token);
			}
			// Overhead per tool definition
			total += 6;
		}
		return total;
	}
}

// #endregion
