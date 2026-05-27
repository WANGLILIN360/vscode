/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/common/editToolLearningService.ts
// Layer: browser — DI-injected implementation of IQuizEditToolLearningService.
// Moved from common/ to comply with the four-layer architecture rules.

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { LRUCache } from '../../../../../base/common/map.js';
import { IStorageService, WillSaveStateReason, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import {
	QuizEditTools,
	QuizEditToolLearningState,
	QuizEditToolLearningConfig,
	IQuizEditToolLearningData,
	QUIZ_EDIT_TOOL_LEARNING_STATES,
} from '../../common/tools/quizEditToolLearningStates.js';
import {
	IQuizEditToolLearningService,
	CACHE_STORAGE_KEY,
	IStoredToolData,
	addToWindow,
} from '../../common/tools/quizEditToolLearningService.js';

/**
 * Implementation of IQuizEditToolLearningService aligned with Copilot's EditToolLearningService.
 *
 * Key patterns from Copilot:
 * - LRU cache per model (CACHE_SIZE = 50)
 * - BigInt success bitset for rolling window tracking
 * - State machine transitions based on success rates
 * - Hardcoded preferences for known model families (gpt, sonnet)
 * - Persistence via globalState/storage
 */
export class QuizEditToolLearningServiceImpl extends Disposable implements IQuizEditToolLearningService {

	declare readonly _serviceBrand: undefined;

	private _cache?: LRUCache<string, IQuizEditToolLearningData>;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();

		// Save cache to storage periodically — aligned with Copilot's globalState.update
		this._register(this._storageService.onWillSaveState(e => {
			if (e.reason === WillSaveStateReason.SHUTDOWN) {
				this._saveCacheToStorage();
			}
		}));
	}

	getPreferredEditTools(modelFamily: string): QuizEditTools[] | undefined {
		// Aligned with Copilot's getPreferredEndpointEditTool:
		// 1. Check hardcoded preferences for known families
		const hardcoded = this._getHardcodedPreferences(modelFamily);
		if (hardcoded) {
			return hardcoded;
		}

		// 2. Check learning data for this model
		const learningData = this._getModelLearningData(modelFamily);
		return this._computePreferences(learningData);
	}

	didMakeEdit(modelId: string, modelFamily: string, tool: QuizEditTools, success: boolean): void {
		// Aligned with Copilot's didMakeEdit:
		// Skip if hardcoded preferences exist for this family
		if (this._getHardcodedPreferences(modelFamily)) {
			return;
		}

		const learningData = this._getModelLearningData(modelId);
		this._recordEdit(modelId, learningData, tool, success);
		this._saveModelLearningData(modelId, learningData);
	}

	// --- Hardcoded preferences (aligned with Copilot's _getHardcodedPreferences) ---

	private _getHardcodedPreferences(family: string): QuizEditTools[] | undefined {
		const lowerFamily = family.toLowerCase();

		// Aligned with Copilot: GPT/OpenAI models prefer apply_patch
		if (lowerFamily.includes('gpt') || lowerFamily.includes('openai')) {
			return [QuizToolName.ApplyPatch];
		}

		// Aligned with Copilot: Sonnet models prefer replace_string + multi_replace_string
		if (lowerFamily.includes('sonnet')) {
			return [QuizToolName.ReplaceString, QuizToolName.MultiReplaceString];
		}

		return undefined;
	}

	// --- State machine (aligned with Copilot's _computePreferences + _checkStateTransitions) ---

	private _computePreferences(data: IQuizEditToolLearningData): QuizEditTools[] | undefined {
		return QUIZ_EDIT_TOOL_LEARNING_STATES[data.state].allowedTools;
	}

	private _checkStateTransitions(modelId: string, data: IQuizEditToolLearningData): QuizEditToolLearningState {
		const currentConfig = QUIZ_EDIT_TOOL_LEARNING_STATES[data.state];

		if (!currentConfig.transitions) {
			return data.state;
		}

		for (const [targetState, condition] of Object.entries(currentConfig.transitions)) {
			if (!condition(data)) {
				continue;
			}

			const target = Number(targetState) as QuizEditToolLearningState;
			return target;
		}

		return data.state;
	}

	// --- Edit recording (aligned with Copilot's _recordEdit) ---

	private _recordEdit(modelId: string, data: IQuizEditToolLearningData, tool: QuizEditTools, success: boolean): void {
		const successBit = success ? 1n : 0n;
		const toolData = (data.tools[tool] ??= { successBitset: 0n, attempts: 0 });
		toolData.successBitset = addToWindow(toolData.successBitset, successBit);
		toolData.attempts++;

		const newState = this._checkStateTransitions(modelId, data);
		if (newState !== data.state) {
			data.state = newState;
			data.tools = {}; // Reset tool data on state transition — aligned with Copilot
		}
	}

	// --- LRU cache (aligned with Copilot's _getCache / _loadCacheFromStorage / _saveCacheToStorage) ---

	private _getCache(): LRUCache<string, IQuizEditToolLearningData> {
		if (!this._cache) {
			this._cache = this._loadCacheFromStorage();
		}
		return this._cache;
	}

	private _loadCacheFromStorage(): LRUCache<string, IQuizEditToolLearningData> {
		const cache = new LRUCache<string, IQuizEditToolLearningData>(QuizEditToolLearningConfig.CACHE_SIZE);
		const storedCacheData = this._storageService.get(CACHE_STORAGE_KEY, 0);

		if (!storedCacheData) {
			return cache;
		}

		try {
			const parsed = JSON.parse(storedCacheData) as { entries: [string, IStoredToolData][] };
			if (!parsed?.entries) {
				return cache;
			}

			for (const [modelId, storedData] of parsed.entries) {
				const data: IQuizEditToolLearningData = {
					state: storedData.state,
					tools: {},
				};
				for (const [tool, toolData] of Object.entries(storedData.tools)) {
					if (toolData) {
						(data.tools as Record<string, { successBitset: bigint; attempts: number }>)[tool] = {
							successBitset: BigInt(toolData.successBitset),
							attempts: toolData.attempts,
						};
					}
				}
				cache.set(modelId, data);
			}
		} catch {
			// Corrupted storage data — start fresh
		}

		return cache;
	}

	private _saveCacheToStorage(): void {
		if (!this._cache) {
			return;
		}

		const entries: [string, IStoredToolData][] = Array.from(this._cache.entries(), ([modelId, data]) => {
			const storedTools: { [K in QuizEditTools]?: { successBitset: string; attempts: number } } = {};
			for (const [tool, toolData] of Object.entries(data.tools)) {
				if (toolData) {
					(storedTools as Record<string, { successBitset: string; attempts: number }>)[tool] = {
						successBitset: '0x' + toolData.successBitset.toString(16),
						attempts: toolData.attempts,
					};
				}
			}
			const storedData: IStoredToolData = {
				state: data.state,
				tools: storedTools,
			};
			return [modelId, storedData];
		});

		this._storageService.store(CACHE_STORAGE_KEY, JSON.stringify({ entries }), StorageScope.PROFILE, StorageTarget.USER);
	}

	private _saveModelLearningData(modelId: string, data: IQuizEditToolLearningData): void {
		const cache = this._getCache();
		cache.set(modelId, data);
		this._saveCacheToStorage();
	}

	private _getModelLearningData(modelId: string): IQuizEditToolLearningData {
		const cache = this._getCache();

		let data = cache.get(modelId);
		if (!data) {
			data = { state: QuizEditToolLearningState.Initial, tools: {} };
			cache.set(modelId, data);
		}
		return data;
	}

	override dispose(): void {
		this._saveCacheToStorage();
		super.dispose();
	}
}
