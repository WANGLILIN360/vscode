/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/common/editToolLearningService.ts
// Layer: common — contains only the interface, service identifier, and pure-logic helpers.
// Implementation moved to browser/tools/quizEditToolLearningServiceImpl.ts to comply with
// the four-layer architecture (common/ must not contain DI-injected classes).

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import {
	QuizEditTools,
	QuizEditToolLearningState,
	QuizEditToolLearningConfig,
} from './quizEditToolLearningStates.js';

// #region IQuizEditToolLearningService (aligned with Copilot's IEditToolLearningService)

export const IQuizEditToolLearningService = createDecorator<IQuizEditToolLearningService>('quizEditToolLearningService');

/**
 * Service that learns from edit tool usage patterns to recommend preferred edit tools.
 * Uses a state machine with transitions based on success/failure rates,
 * an LRU cache per model, and persistence via IStorageService.
 *
 * Aligned with Copilot's IEditToolLearningService
 * (from tools/common/editToolLearningService.ts).
 */
export interface IQuizEditToolLearningService {
	readonly _serviceBrand: undefined;

	/**
	 * Get the preferred edit tools for a model family.
	 * Returns the list of allowed tools from the current learning state,
	 * or hardcoded preferences for known model families.
	 * Aligned with Copilot's getPreferredEndpointEditTool.
	 */
	getPreferredEditTools(modelFamily: string): QuizEditTools[] | undefined;

	/**
	 * Record an edit tool usage event and update learning state.
	 * Aligned with Copilot's didMakeEdit.
	 */
	didMakeEdit(modelId: string, modelFamily: string, tool: QuizEditTools, success: boolean): void;
}

// #endregion

// #region Storage helpers (aligned with Copilot's IStoredToolData)
// These are pure logic (no DI) and remain in common/.

export const CACHE_STORAGE_KEY = 'quiz.editToolLearning.cache';

export interface IStoredToolData {
	state: QuizEditToolLearningState;
	tools: { [K in QuizEditTools]?: { successBitset: string; attempts: number } };
}

export function addToWindow(window: bigint, bit: bigint): bigint {
	const mask = (1n << BigInt(QuizEditToolLearningConfig.WINDOW_SIZE)) - 1n;
	return ((window << 1n) | bit) & mask;
}

// #endregion
