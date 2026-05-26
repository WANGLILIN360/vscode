/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/promptCategorizer.ts

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { QuizPromptClassification, quizIsValidIntent, quizIsValidDomain, quizIsValidScope } from './quizPromptCategorizationTaxonomy.js';

export const IQuizPromptCategorizerService = createDecorator<IQuizPromptCategorizerService>('quizPromptCategorizerService');

export interface IQuizPromptCategorizerService {
	readonly _serviceBrand: undefined;

	/**
	 * Categorizes the first user prompt in a chat session.
	 * This runs as a fire-and-forget operation and sends results to telemetry.
	 * Only runs for panel location, first attempt, non-subagent requests.
	 */
	categorizePrompt(request: IQuizCategorizerRequest, context: IQuizCategorizerContext, telemetryMessageId: string): void;
}

export interface IQuizCategorizerRequest {
	readonly prompt: string;
	readonly references?: readonly unknown[];
	readonly toolReferences?: readonly unknown[];
	readonly sessionId?: string;
	readonly id?: string;
	readonly attempt?: number;
	readonly location2?: unknown;
	readonly subAgentName?: string;
	readonly modeInstructions2?: { isBuiltin?: boolean; name?: string };
}

export interface IQuizCategorizerContext {
	readonly history: readonly unknown[];
	readonly sessionResource?: unknown;
}

// Categorization outcome values for telemetry
export const QUIZ_CATEGORIZATION_OUTCOMES = {
	SUCCESS: '',
	TIMEOUT: 'timeout',
	REQUEST_FAILED: 'requestFailed',
	NO_TOOL_CALL: 'noToolCall',
	PARSE_ERROR: 'parseError',
	INVALID_CLASSIFICATION: 'invalidClassification',
	PARTIAL_CLASSIFICATION: 'partialClassification',
	ERROR: 'error',
} as const;

// ISO 8601 duration regex
const ISO_8601_DURATION_REGEX = /^PT(?!$)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

export function quizIsValidIsoDuration(duration: string): boolean {
	return ISO_8601_DURATION_REGEX.test(duration);
}

/**
 * Returns true when the partial classification has fully valid ISO 8601 time estimates.
 */
export function quizHasValidTimeEstimates(partial: QuizPromptClassification): boolean {
	return partial.timeEstimate.bestCase !== '' && partial.timeEstimate.realistic !== '';
}

/**
 * Extracts a partial classification from the LLM response, validating only the core
 * fields (intent, domain, scope, confidence, reasoning). Time estimates are extracted
 * on a best-effort basis.
 */
export function quizExtractPartialClassification(obj: unknown): QuizPromptClassification | undefined {
	if (typeof obj !== 'object' || obj === null) {
		return undefined;
	}

	const c = obj as Record<string, unknown>;

	if (
		typeof c.intent !== 'string' || !quizIsValidIntent(c.intent) ||
		typeof c.domain !== 'string' || !quizIsValidDomain(c.domain) ||
		typeof c.scope !== 'string' || !quizIsValidScope(c.scope) ||
		typeof c.confidence !== 'number' || c.confidence < 0 || c.confidence > 1 ||
		typeof c.reasoning !== 'string'
	) {
		return undefined;
	}

	let bestCase = '';
	let realistic = '';
	if (typeof c.timeEstimate === 'object' && c.timeEstimate !== null) {
		const te = c.timeEstimate as Record<string, unknown>;
		if (typeof te.bestCase === 'string' && quizIsValidIsoDuration(te.bestCase)) {
			bestCase = te.bestCase;
		}
		if (typeof te.realistic === 'string' && quizIsValidIsoDuration(te.realistic)) {
			realistic = te.realistic;
		}
	}

	return {
		intent: c.intent,
		domain: c.domain,
		scope: c.scope,
		confidence: c.confidence,
		reasoning: c.reasoning,
		timeEstimate: { bestCase, realistic },
	};
}

/**
 * Null implementation.
 */
export class NullQuizPromptCategorizerService implements IQuizPromptCategorizerService {
	declare readonly _serviceBrand: undefined;

	categorizePrompt(): void {
		// no-op
	}
}
