/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolInfo, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizCopilotTool, IQuizToolInvocationContext, QuizCopilotToolMode, IQuizToolRegistry } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';

// #region QuizBuiltinToolBase (aligned with Copilot's ICopilotTool base pattern)

/**
 * Base class for built-in Quiz tools.
 * Provides the tool definition and common helpers.
 * Aligned with Copilot's ICopilotTool constructor pattern.
 */
export abstract class QuizBuiltinTool<T> implements IQuizCopilotTool<T> {

	abstract readonly toolName: QuizToolName;
	abstract readonly definition: IQuizToolDefinition;

	invoke?(parameters: T, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult>;
	prepareInvocation?(parameters: T, token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }>;
	filterEdits?(resource: URI): Promise<{ title: string; message: string } | undefined>;
	provideInput?(promptContext: unknown): Promise<T | undefined>;
	resolveInput?(input: T, promptContext: unknown, mode: QuizCopilotToolMode): Promise<T>;

	/**
	 * Get the IQuizToolInfo for this tool (used for registration with ILanguageModelToolsService).
	 */
	getToolInfo(): IQuizToolInfo {
		return {
			name: this.toolName,
			description: this.definition.description,
			inputSchema: this.definition.inputSchema,
		};
	}
}

// #endregion

// #region QuizBuiltinToolRegistry (static registry, aligned with Copilot's ToolRegistry singleton)

/**
 * Static registry for built-in Quiz tools.
 * Tools self-register via `QuizBuiltinToolRegistry.register()` at import time,
 * mirroring Copilot's `ToolRegistry.registerTool()` pattern.
 *
 * The QuizToolsServiceImpl reads from this registry during initialization
 * to populate its IQuizToolRegistry instance.
 */
export class QuizBuiltinToolRegistry {

	private static readonly _tools: Map<QuizToolName, QuizBuiltinTool<unknown>> = new Map();

	/**
	 * Register a built-in tool. Called at module import time.
	 */
	static register(tool: QuizBuiltinTool<unknown>): IDisposable {
		QuizBuiltinToolRegistry._tools.set(tool.toolName, tool);
		return { dispose: () => QuizBuiltinToolRegistry._tools.delete(tool.toolName) };
	}

	/**
	 * Get all registered built-in tools.
	 */
	static getAll(): ReadonlyMap<QuizToolName, QuizBuiltinTool<unknown>> {
		return QuizBuiltinToolRegistry._tools;
	}

	/**
	 * Get a specific built-in tool by name.
	 */
	static get(name: QuizToolName): QuizBuiltinTool<unknown> | undefined {
		return QuizBuiltinToolRegistry._tools.get(name);
	}

	/**
	 * Populate an IQuizToolRegistry with all registered built-in tools.
	 * Called by QuizToolsServiceImpl during initialization.
	 */
	static populateRegistry(registry: IQuizToolRegistry): IDisposable[] {
		const disposables: IDisposable[] = [];
		for (const [name, tool] of QuizBuiltinToolRegistry._tools) {
			disposables.push(registry.registerCopilotTool(name, tool));
		}
		return disposables;
	}
}

// #endregion

// #region Tool result helpers

/**
 * Create a successful tool result with text content.
 */
export function quizToolResultText(text: string): IQuizToolResult {
	return { text, error: false };
}

/**
 * Create an error tool result.
 */
export function quizToolResultError(message: string): IQuizToolResult {
	return { text: message, error: true };
}

// #endregion
