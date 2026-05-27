/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { IQuizToolInfo } from '../intents/quizIntents.js';

// #region IQuizToolDeferralService (aligned with Copilot's ToolDeferralService)

/**
 * Service that manages deferred tool loading — tools whose full definitions
 * are not sent to the model initially to save token budget, but can be
 * resolved on demand when the model requests them.
 *
 * Aligned with Copilot's ToolDeferralService
 * (from tools/common/toolDeferralService.ts).
 *
 * This is particularly useful for:
 * - Tools with large input schemas that consume many tokens
 * - Tools that are rarely used but still need to be discoverable
 * - Models that support tool search (Responses API)
 */
export interface IQuizToolDeferralService {
	/**
	 * Check if a tool should be deferred (not included in the initial tool list).
	 */
	shouldDefer(toolName: string, modelFamily: string): boolean;

	/**
	 * Get the deferred tool names for a given model family.
	 */
	getDeferredToolNames(modelFamily: string): string[];

	/**
	 * Resolve a deferred tool's full definition.
	 * Returns the full tool info for a previously deferred tool.
	 */
	resolveDeferredTool(toolName: string): IQuizToolInfo | undefined;

	/**
	 * Register a tool as deferrable with a lightweight placeholder definition.
	 */
	registerDeferredTool(toolName: string, placeholder: IQuizToolInfo, fullDefinition: IQuizToolInfo): IDisposable;

	/**
	 * Apply deferral to a tool list — replace deferred tools with placeholders.
	 * Returns the modified tool list with placeholders replacing full definitions.
	 */
	applyDeferral(tools: readonly IQuizToolInfo[], modelFamily: string): IQuizToolInfo[];
}

// #endregion

// #region QuizToolDeferralServiceImpl

/**
 * Default implementation of IQuizToolDeferralService.
 * Manages deferred tools with placeholder definitions.
 */
export class QuizToolDeferralServiceImpl extends Disposable implements IQuizToolDeferralService {

	private readonly _deferredTools = new Map<string, { placeholder: IQuizToolInfo; fullDefinition: IQuizToolInfo }>();
	private readonly _deferredForFamily = new Map<string, Set<string>>();

	shouldDefer(toolName: string, modelFamily: string): boolean {
		const familySet = this._deferredForFamily.get(modelFamily);
		return !!familySet?.has(toolName);
	}

	getDeferredToolNames(modelFamily: string): string[] {
		const familySet = this._deferredForFamily.get(modelFamily);
		return familySet ? [...familySet] : [];
	}

	resolveDeferredTool(toolName: string): IQuizToolInfo | undefined {
		return this._deferredTools.get(toolName)?.fullDefinition;
	}

	registerDeferredTool(toolName: string, placeholder: IQuizToolInfo, fullDefinition: IQuizToolInfo): IDisposable {
		this._deferredTools.set(toolName, { placeholder, fullDefinition });
		return { dispose: () => this._deferredTools.delete(toolName) };
	}

	applyDeferral(tools: readonly IQuizToolInfo[], modelFamily: string): IQuizToolInfo[] {
		const result: IQuizToolInfo[] = [];
		for (const tool of tools) {
			const deferred = this._deferredTools.get(tool.name);
			if (deferred && this.shouldDefer(tool.name, modelFamily)) {
				result.push(deferred.placeholder);
			} else {
				result.push(tool);
			}
		}
		return result;
	}

	override dispose(): void {
		super.dispose();
		this._deferredTools.clear();
		this._deferredForFamily.clear();
	}
}

// #endregion
