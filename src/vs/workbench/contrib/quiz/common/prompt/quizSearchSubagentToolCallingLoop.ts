/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/searchSubagentToolCallingLoop.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizBuildPromptContext, IQuizBuildPromptResult, IQuizToolInfo } from '../intents/quizIntents.js';

/**
 * Options for the search subagent tool calling loop.
 */
export interface IQuizSearchSubagentToolCallingLoopOptions {
	readonly request: unknown;
	readonly location: string;
	readonly promptText: string;
	/** Optional pre-generated subagent invocation ID */
	readonly subAgentInvocationId?: string;
	/** The tool_call_id from the parent agent's LLM response */
	readonly parentToolCallId?: string;
	/** The headerRequestId from the parent agent's fetch response */
	readonly parentHeaderRequestId?: string;
	/** The modelCallId from the parent agent's model call */
	readonly parentModelCallId?: string;
	/** The top-level turn ID for aggregating credits */
	readonly topLevelTurnId?: string;
	/** Thoroughness level for the search */
	readonly thoroughness?: 'normal' | 'deep';
	readonly toolCallLimit?: number;
	readonly conversation: { sessionId: string };
}

/**
 * Interface for a search subagent tool calling loop that performs
 * search operations using a restricted set of tools.
 *
 * In Copilot, this extends ToolCallingLoop. In Quiz Core, this
 * is defined as an interface to be implemented by the
 * electron-browser layer.
 */
export interface IQuizSearchSubagentToolCallingLoop {
	/**
	 * Run the search subagent tool calling loop.
	 */
	run(
		promptContext: IQuizBuildPromptContext,
		progress: unknown,
		token: CancellationToken,
	): Promise<IQuizBuildPromptResult>;

	/**
	 * Get the tools available for search operations.
	 * Only includes search-relevant tools: semantic_search, findFiles,
	 * findTextInFiles, readFile.
	 */
	getAvailableTools(): Promise<IQuizToolInfo[]>;
}

/**
 * Stub implementation.
 */
export class NullQuizSearchSubagentToolCallingLoop implements IQuizSearchSubagentToolCallingLoop {
	async run(_promptContext: IQuizBuildPromptContext, _progress: unknown, _token: CancellationToken): Promise<IQuizBuildPromptResult> {
		return { messages: [], tokenCount: 0 };
	}

	async getAvailableTools(): Promise<IQuizToolInfo[]> {
		return [];
	}
}
