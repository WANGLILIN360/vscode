/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/node/editToolLearningService.ts

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region IQuizEditToolLearningService (aligned with Copilot's IEditToolLearningService)

export const IQuizEditToolLearningService = createDecorator<IQuizEditToolLearningService>('quizEditToolLearningService');

/**
 * Service that learns from edit tool usage patterns to improve future edits.
 * Tracks which edit strategies succeed or fail for different file types and
 * language patterns, and uses this data to suggest better edit approaches.
 *
 * Aligned with Copilot's IEditToolLearningService
 * (from tools/node/editToolLearningService.ts).
 */
export interface IQuizEditToolLearningService {
	readonly _serviceBrand: undefined;

	/**
	 * Record an edit tool usage event.
	 * @param toolName The tool that was used (e.g., insert_edit, apply_patch, replace_string)
	 * @param filePath The file that was edited
	 * @param languageId The language of the file
	 * @param success Whether the edit was successful
	 * @param strategy The edit strategy used (e.g., 'insert', 'replace', 'patch')
	 */
	recordEditUsage(toolName: string, filePath: string, languageId: string, success: boolean, strategy: string): void;

	/**
	 * Get the recommended edit strategy for a given file type and language.
	 * Returns the strategy name with the highest success rate.
	 * @param languageId The language of the file to edit
	 * @returns The recommended strategy name, or undefined if no data is available
	 */
	getRecommendedStrategy(languageId: string): string | undefined;

	/**
	 * Get the recommended tool for a given file type and language.
	 * Returns the tool name with the highest success rate.
	 * @param languageId The language of the file to edit
	 * @returns The recommended tool name, or undefined if no data is available
	 */
	getRecommendedTool(languageId: string): string | undefined;
}

// #endregion

// #region QuizEditToolLearningServiceImpl

/**
 * Default implementation of IQuizEditToolLearningService.
 * Tracks edit usage in memory (not persisted across sessions).
 *
 * In Copilot, this service persists data and uses more sophisticated
 * analytics. This implementation provides the same interface with
 * simple in-memory tracking.
 */
export class QuizEditToolLearningServiceImpl extends Disposable implements IQuizEditToolLearningService {

	declare readonly _serviceBrand: undefined;

	private readonly _usageData = new Map<string, { successes: number; failures: number; strategy: string; toolName: string }[]>();

	recordEditUsage(toolName: string, filePath: string, languageId: string, success: boolean, strategy: string): void {
		const key = languageId;
		let entries = this._usageData.get(key);
		if (!entries) {
			entries = [];
			this._usageData.set(key, entries);
		}

		const existing = entries.find(e => e.toolName === toolName && e.strategy === strategy);
		if (existing) {
			if (success) {
				existing.successes++;
			} else {
				existing.failures++;
			}
		} else {
			entries.push({
				toolName,
				successes: success ? 1 : 0,
				failures: success ? 0 : 1,
				strategy,
			});
		}
	}

	getRecommendedStrategy(languageId: string): string | undefined {
		const entries = this._usageData.get(languageId);
		if (!entries || entries.length === 0) {
			return undefined;
		}

		// Find the entry with the highest success rate (minimum 2 uses)
		const qualified = entries.filter(e => e.successes + e.failures >= 2);
		if (qualified.length === 0) {
			return undefined;
		}

		qualified.sort((a, b) => {
			const rateA = a.successes / (a.successes + a.failures);
			const rateB = b.successes / (b.successes + b.failures);
			return rateB - rateA;
		});

		return qualified[0].strategy;
	}

	getRecommendedTool(languageId: string): string | undefined {
		const entries = this._usageData.get(languageId);
		if (!entries || entries.length === 0) {
			return undefined;
		}

		const qualified = entries.filter(e => e.successes + e.failures >= 2);
		if (qualified.length === 0) {
			return undefined;
		}

		qualified.sort((a, b) => {
			const rateA = a.successes / (a.successes + a.failures);
			const rateB = b.successes / (b.successes + b.failures);
			return rateB - rateA;
		});

		return qualified[0].toolName;
	}

	override dispose(): void {
		super.dispose();
		this._usageData.clear();
	}
}

// #endregion
