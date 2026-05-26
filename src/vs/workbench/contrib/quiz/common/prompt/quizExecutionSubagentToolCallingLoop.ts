/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/executionSubagentToolCallingLoop.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizBuildPromptContext, IQuizBuildPromptResult, IQuizToolInfo } from '../intents/quizIntents.js';

/**
 * Options for the execution subagent tool calling loop.
 */
export interface IQuizExecutionSubagentToolCallingLoopOptions {
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
	readonly toolCallLimit?: number;
	readonly conversation: { sessionId: string };
}

/** A terminal command that is no longer being awaited by the subagent */
export interface IQuizBackgroundCommand {
	readonly command: string;
	readonly termId: string;
	readonly reason: 'timeout' | 'async' | 'inputNeeded';
	/** Only set when reason === 'timeout' */
	readonly timeoutMs?: number;
}

/**
 * Interface for an execution subagent tool calling loop that performs
 * terminal/command execution using a restricted set of tools.
 *
 * In Copilot, this extends ToolCallingLoop. In Quiz Core, this
 * is defined as an interface to be implemented by the
 * electron-browser layer.
 */
export interface IQuizExecutionSubagentToolCallingLoop {
	/**
	 * Run the execution subagent tool calling loop.
	 */
	run(
		promptContext: IQuizBuildPromptContext,
		progress: unknown,
		token: CancellationToken,
	): Promise<IQuizBuildPromptResult>;

	/**
	 * Get the tools available for execution operations.
	 * Only includes run_in_terminal.
	 */
	getAvailableTools(): Promise<IQuizToolInfo[]>;

	/**
	 * Terminal calls from previous rounds that the subagent is no longer
	 * awaiting (timeout-moved-to-background or async-from-start).
	 */
	readonly backgroundCommands: readonly IQuizBackgroundCommand[];
}

/**
 * Stub implementation.
 */
export class NullQuizExecutionSubagentToolCallingLoop implements IQuizExecutionSubagentToolCallingLoop {
	readonly backgroundCommands: readonly IQuizBackgroundCommand[] = [];

	async run(_promptContext: IQuizBuildPromptContext, _progress: unknown, _token: CancellationToken): Promise<IQuizBuildPromptResult> {
		return { messages: [], tokenCount: 0 };
	}

	async getAvailableTools(): Promise<IQuizToolInfo[]> {
		return [];
	}
}
