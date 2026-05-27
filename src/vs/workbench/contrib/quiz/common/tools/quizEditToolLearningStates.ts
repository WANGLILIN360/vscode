/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/common/editToolLearningStates.ts

import { QuizToolName } from './quizToolNames.js';

export type QuizEditTools = QuizToolName.ApplyPatch | QuizToolName.ReplaceString | QuizToolName.EditFile | QuizToolName.MultiReplaceString;

export interface IQuizEditToolLearningData {
	state: QuizEditToolLearningState;
	tools: { [K in QuizEditTools]?: QuizToolLearningData };
}

export const enum QuizEditToolLearningConfig {
	/** Rolling window size for tracking recent edit successes/failures per tool */
	WINDOW_SIZE = 100,
	/** Maximum number of models to keep in memory cache before LRU eviction */
	CACHE_SIZE = 50,
	/** Minimum attempts before making state transition decisions */
	MIN_SAMPLE_SIZE = QuizEditToolLearningConfig.WINDOW_SIZE * (2 / 3),
	/** Success rate threshold for considering replace_string to be a usable tool */
	SR_SUCCESS_THRESHOLD = 0.8,
	/** Failure rate threshold to disable replace_string */
	SR_FAILURE_THRESHOLD = 0.3,
	/** Success rate threshold for considering multi_replace_string to be a usable tool */
	MULTISR_SUCCESS_THRESHOLD = 0.7,
	/** Failure rate threshold to disable multi_replace_string */
	MULTISR_FAILURE_THRESHOLD = 0.4,
}

export const enum QuizEditToolLearningState {
	Initial,
	ReplaceStringForced,
	ReplaceStringMaybeMulti,
	EditFileOnly,
	ReplaceStringOnly,
	ReplaceStringWithMulti,
}

interface QuizStateConfig {
	allowedTools: QuizEditTools[];
	transitions?: { [K in QuizEditToolLearningState]?: (data: IQuizEditToolLearningData) => boolean };
}

interface QuizToolLearningData {
	successBitset: bigint;
	attempts: number;
}

// Top-level helper functions
function getSuccessRate(successBitset: bigint, totalAttempts: number): number {
	if (totalAttempts === 0) {
		return 0;
	}

	const actualBits = Math.min(totalAttempts, QuizEditToolLearningConfig.WINDOW_SIZE);
	let successCount = 0;

	for (let i = 0; i < actualBits; i++) {
		if ((successBitset >> BigInt(i)) & 1n) {
			successCount++;
		}
	}

	return successCount / actualBits;
}

function sampleSize(data: IQuizEditToolLearningData, tool: QuizEditTools): number {
	return Math.min(data.tools[tool]?.attempts || 0, QuizEditToolLearningConfig.WINDOW_SIZE);
}

function successRate(data: IQuizEditToolLearningData, tool: QuizEditTools): number {
	const toolData = data.tools[tool];
	if (!toolData) { return 0; }
	return getSuccessRate(toolData.successBitset, toolData.attempts);
}

export const QUIZ_EDIT_TOOL_LEARNING_STATES: Record<QuizEditToolLearningState, QuizStateConfig> = {
	[QuizEditToolLearningState.Initial]: {
		allowedTools: [QuizToolName.EditFile, QuizToolName.ReplaceString],
		transitions: {
			[QuizEditToolLearningState.ReplaceStringMaybeMulti]: d =>
				sampleSize(d, QuizToolName.ReplaceString) > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE &&
				successRate(d, QuizToolName.ReplaceString) > QuizEditToolLearningConfig.SR_SUCCESS_THRESHOLD,
			[QuizEditToolLearningState.EditFileOnly]: d =>
				sampleSize(d, QuizToolName.ReplaceString) > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE &&
				successRate(d, QuizToolName.ReplaceString) < QuizEditToolLearningConfig.SR_FAILURE_THRESHOLD,
			[QuizEditToolLearningState.ReplaceStringForced]: d => {
				const editFileAttempts = sampleSize(d, QuizToolName.EditFile);
				const replaceStringAttempts = sampleSize(d, QuizToolName.ReplaceString);
				return editFileAttempts > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE && editFileAttempts / (editFileAttempts + replaceStringAttempts) > 0.7;
			},
		},
	},
	[QuizEditToolLearningState.ReplaceStringForced]: {
		allowedTools: [QuizToolName.ReplaceString],
		transitions: {
			[QuizEditToolLearningState.ReplaceStringMaybeMulti]: d =>
				sampleSize(d, QuizToolName.ReplaceString) > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE &&
				successRate(d, QuizToolName.ReplaceString) > QuizEditToolLearningConfig.SR_SUCCESS_THRESHOLD,
			[QuizEditToolLearningState.EditFileOnly]: d =>
				sampleSize(d, QuizToolName.ReplaceString) > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE &&
				successRate(d, QuizToolName.ReplaceString) < QuizEditToolLearningConfig.SR_FAILURE_THRESHOLD,
		},
	},
	[QuizEditToolLearningState.ReplaceStringMaybeMulti]: {
		allowedTools: [QuizToolName.ReplaceString, QuizToolName.MultiReplaceString],
		transitions: {
			[QuizEditToolLearningState.ReplaceStringWithMulti]: d =>
				sampleSize(d, QuizToolName.MultiReplaceString) > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE &&
				successRate(d, QuizToolName.MultiReplaceString) > QuizEditToolLearningConfig.MULTISR_SUCCESS_THRESHOLD,
			[QuizEditToolLearningState.ReplaceStringOnly]: d =>
				sampleSize(d, QuizToolName.MultiReplaceString) > QuizEditToolLearningConfig.MIN_SAMPLE_SIZE &&
				successRate(d, QuizToolName.MultiReplaceString) < QuizEditToolLearningConfig.MULTISR_FAILURE_THRESHOLD,
		},
	},

	// Terminal states have no transitions
	[QuizEditToolLearningState.EditFileOnly]: {
		allowedTools: [QuizToolName.EditFile],
	},
	[QuizEditToolLearningState.ReplaceStringOnly]: {
		allowedTools: [QuizToolName.ReplaceString],
	},
	[QuizEditToolLearningState.ReplaceStringWithMulti]: {
		allowedTools: [QuizToolName.ReplaceString, QuizToolName.MultiReplaceString],
	},
};
