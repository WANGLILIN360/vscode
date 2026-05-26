/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';

// Core type definitions for Quiz AI assistant

export interface IQuizService {
	readonly _serviceBrand: undefined;
	handleRequest(params: IQuizHandleRequestParams): Promise<void>;
}

export interface IQuizHandleRequestParams {
	readonly request: unknown;
	readonly progressCallback: (progress: unknown[]) => void;
	readonly history: unknown[];
	readonly sessionResource: URI;
	readonly token: unknown;
}

/**
 * Token usage information from a model response.
 * Aligned with Copilot's usage tracking.
 */
export interface IQuizTokenUsage {
	readonly promptTokens: number;
	readonly completionTokens: number;
	readonly totalTokens?: number;
	/** Cached tokens (for prompt caching models) */
	readonly cachedTokens?: number;
}

/**
 * Token budget for a request, tracking remaining capacity.
 * Aligned with Copilot's token budget management.
 */
export interface IQuizTokenBudget {
	/** Maximum prompt tokens the model can accept */
	readonly maxPromptTokens: number;
	/** Maximum output tokens the model can produce */
	readonly maxOutputTokens: number;
	/** Currently used prompt tokens (estimated) */
	readonly usedPromptTokens: number;
	/** Remaining prompt token budget */
	readonly remainingPromptTokens: number;
	/** Reserved output tokens (not included in prompt budget) */
	readonly reservedOutputTokens: number;
}

/**
 * Tokenizer type, aligned with Copilot's TokenizerType.
 * Determines which tokenizer algorithm to use for token counting.
 */
export const enum QuizTokenizerType {
	/** OpenAI O200K tokenizer (GPT-4o, o1, etc.) */
	O200K = 1,
	/** OpenAI CL100K tokenizer (GPT-4, GPT-3.5) */
	CL100K = 2,
	/** Anthropic tokenizer */
	Anthropic = 3,
	/** Simple character-based estimation (~4 chars/token) */
	CharLevel = 4,
}

/**
 * Interface for a tokenizer that can count tokens.
 * Aligned with Copilot's ITokenizer.
 */
export interface IQuizTokenizer {
	/** The tokenizer type */
	readonly type: QuizTokenizerType;
	/** Count tokens in a string */
	countTokens(text: string, token: CancellationToken): Promise<number>;
	/** Estimate tokens synchronously (may be approximate) */
	estimateTokens(text: string): number;
}
