/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/codebaseToolCalling.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizBuildPromptContext, IQuizBuildPromptResult, IQuizToolInfo } from '../intents/quizIntents.js';

/**
 * Options for the codebase tool calling loop.
 */
export interface IQuizCodebaseToolCallingLoopOptions {
	readonly request: unknown;
	readonly location: string;
	readonly toolCallLimit?: number;
	readonly conversation: { sessionId: string };
}

/**
 * Interface for a codebase tool calling loop that performs
 * codebase search operations using tool calls.
 *
 * In Copilot, this extends ToolCallingLoop which handles the full
 * LLM request/response cycle with tool calls. In Quiz Core, this
 * is defined as an interface to be implemented by the electron-browser
 * layer where the actual endpoint and tool services are available.
 */
export interface IQuizCodebaseToolCallingLoop {
	/**
	 * Run the codebase search tool calling loop.
	 */
	run(
		promptContext: IQuizBuildPromptContext,
		progress: unknown,
		token: CancellationToken,
	): Promise<IQuizBuildPromptResult>;

	/**
	 * Get the tools available for codebase search.
	 */
	getAvailableTools(): Promise<IQuizToolInfo[]>;
}

/**
 * Stub implementation that returns empty results.
 * The real implementation should be provided by the
 * electron-browser layer using Core services.
 */
export class NullQuizCodebaseToolCallingLoop implements IQuizCodebaseToolCallingLoop {
	async run(_promptContext: IQuizBuildPromptContext, _progress: unknown, _token: CancellationToken): Promise<IQuizBuildPromptResult> {
		return { messages: [], tokenCount: 0 };
	}

	async getAvailableTools(): Promise<IQuizToolInfo[]> {
		return [];
	}
}
