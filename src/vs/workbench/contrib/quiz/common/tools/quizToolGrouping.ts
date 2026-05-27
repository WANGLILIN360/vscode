/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IQuizToolInfo, IQuizToolDefinition } from '../intents/quizIntents.js';
import { QuizToolCategory, QuizToolName } from './quizToolNames.js';

// #region IQuizVirtualTool (aligned with Copilot's VirtualTool)

/**
 * A virtual tool that represents a group of related tools collapsed into one entry.
 * When the model calls the virtual tool, the group is expanded to reveal the
 * individual tools. This reduces the number of tool definitions sent to the model,
 * saving tokens while preserving access to the full tool set.
 *
 * Aligned with Copilot's VirtualTool (from tools/common/virtualTools/virtualTool.ts).
 */
export interface IQuizVirtualTool {
	/** The virtual tool's display name (used as the tool name sent to the model) */
	readonly name: string;
	/** Human-readable description of the tool group */
	readonly description: string;
	/** The category this virtual tool represents */
	readonly category: QuizToolCategory;
	/** The real tools that are hidden behind this virtual tool */
	readonly hiddenTools: readonly string[];
	/** The input schema for the virtual tool (typically minimal — just a query) */
	readonly inputSchema: object;
	/** Whether this virtual tool is expanded (showing real tools) or collapsed */
	readonly isExpanded: boolean;
}

// #endregion

// #region IQuizToolGroupingService (aligned with Copilot's ToolGroupingService)

/**
 * Service that manages tool grouping — collapsing groups of related tools
 * into virtual tools to save token budget, and expanding them on demand.
 *
 * Aligned with Copilot's ToolGroupingService
 * (from tools/common/virtualTools/toolGroupingService.ts).
 */
export interface IQuizToolGroupingService {
	/**
	 * Get the virtual tools for a given set of available tools.
	 * Returns virtual tool definitions for tools that should be grouped.
	 */
	getVirtualTools(availableTools: readonly IQuizToolInfo[]): IQuizVirtualTool[];

	/**
	 * Check if a tool name corresponds to a virtual tool.
	 */
	isVirtualTool(toolName: string): boolean;

	/**
	 * Expand a virtual tool, revealing the hidden tools behind it.
	 * Returns the real tool names that were hidden.
	 */
	expandVirtualTool(virtualToolName: string): string[];

	/**
	 * Collapse a virtual tool group back into its virtual representation.
	 */
	collapseVirtualTool(virtualToolName: string): void;

	/**
	 * Get the real tool names hidden behind a virtual tool.
	 */
	getHiddenToolNames(virtualToolName: string): string[];

	/**
	 * Apply grouping to a tool list — replace grouped tools with virtual tools.
	 * Returns the modified tool list with virtual tools replacing their hidden members.
	 */
	applyGrouping(tools: readonly IQuizToolInfo[]): IQuizToolInfo[];
}

// #endregion

// #region QuizVirtualToolDefaults (aligned with Copilot's virtual tool definitions)

/**
 * Default virtual tool definitions, one per tool category.
 * Aligned with Copilot's built-in virtual tool groups.
 */
export const quizVirtualToolDefaults: readonly IQuizVirtualTool[] = [
	{
		name: 'quiz_jupyter_tools',
		description: 'Jupyter notebook tools — create, edit, run, and read notebook cells',
		category: QuizToolCategory.JupyterNotebook,
		hiddenTools: [
			QuizToolName.CreateNewJupyterNotebook,
			QuizToolName.EditNotebook,
			QuizToolName.RunNotebookCell,
			QuizToolName.GetNotebookSummary,
			QuizToolName.ReadCellOutput,
		],
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'What you want to do with Jupyter notebooks' },
			},
			required: ['query'],
		},
		isExpanded: false,
	},
	{
		name: 'quiz_web_tools',
		description: 'Web interaction tools — fetch web pages, search GitHub repos',
		category: QuizToolCategory.WebInteraction,
		hiddenTools: [
			QuizToolName.FetchWebPage,
			QuizToolName.GithubSemanticRepoSearch,
			QuizToolName.GithubTextSearch,
			QuizToolName.CoreOpenBrowserPage,
			QuizToolName.CoreClickElement,
			QuizToolName.CoreScreenshotPage,
			QuizToolName.CoreNavigatePage,
			QuizToolName.CoreReadPage,
			QuizToolName.CoreHoverElement,
			QuizToolName.CoreDragElement,
			QuizToolName.CoreTypeInPage,
			QuizToolName.CoreHandleDialog,
			QuizToolName.CoreRunPlaywrightCode,
		],
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'What you want to do on the web' },
			},
			required: ['query'],
		},
		isExpanded: false,
	},
	{
		name: 'quiz_vscode_tools',
		description: 'VS Code interaction tools — search symbols, get errors, run commands',
		category: QuizToolCategory.VSCodeInteraction,
		hiddenTools: [
			QuizToolName.SearchWorkspaceSymbols,
			QuizToolName.GetErrors,
			QuizToolName.VSCodeAPI,
			QuizToolName.GetScmChanges,
			QuizToolName.CreateNewWorkspace,
			QuizToolName.InstallExtension,
			QuizToolName.CoreCreateAndRunTask,
			QuizToolName.RunVscodeCmd,
			QuizToolName.CoreTerminalSelection,
			QuizToolName.CoreTerminalLastCommand,
			QuizToolName.CoreConfirmationTool,
			QuizToolName.CoreConfirmationToolWithOptions,
			QuizToolName.CoreReviewPlan,
			QuizToolName.CoreTerminalConfirmationTool,
			QuizToolName.CoreAskQuestions,
			QuizToolName.SwitchAgent,
			QuizToolName.Memory,
		],
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'What you want to do in VS Code' },
			},
			required: ['query'],
		},
		isExpanded: false,
	},
	{
		name: 'quiz_testing_tools',
		description: 'Testing tools — find and run tests, get test failures',
		category: QuizToolCategory.Testing,
		hiddenTools: [
			QuizToolName.FindTestFiles,
			QuizToolName.CoreRunTest,
			QuizToolName.CoreTestFailure,
		],
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'What you want to do with tests' },
			},
			required: ['query'],
		},
		isExpanded: false,
	},
];

// #endregion

// #region QuizToolGroupingServiceImpl

/**
 * Default implementation of IQuizToolGroupingService.
 * Uses the predefined virtual tool defaults from quizVirtualToolDefaults.
 */
export class QuizToolGroupingServiceImpl extends Disposable implements IQuizToolGroupingService {

	private readonly _expandedGroups = new Set<string>();
	private readonly _virtualToolsByName = new Map<string, IQuizVirtualTool>();

	constructor() {
		super();
		for (const vt of quizVirtualToolDefaults) {
			this._virtualToolsByName.set(vt.name, vt);
		}
	}

	getVirtualTools(availableTools: readonly IQuizToolInfo[]): IQuizVirtualTool[] {
		const result: IQuizVirtualTool[] = [];
		const availableNames = new Set(availableTools.map(t => t.name));

		for (const vt of this._virtualToolsByName.values()) {
			// Only include the virtual tool if at least one of its hidden tools is available
			const hasAvailableHidden = vt.hiddenTools.some(name => availableNames.has(name));
			if (hasAvailableHidden && !this._expandedGroups.has(vt.name)) {
				result.push(vt);
			}
		}
		return result;
	}

	isVirtualTool(toolName: string): boolean {
		return this._virtualToolsByName.has(toolName);
	}

	expandVirtualTool(virtualToolName: string): string[] {
		const vt = this._virtualToolsByName.get(virtualToolName);
		if (!vt) { return []; }
		this._expandedGroups.add(virtualToolName);
		return [...vt.hiddenTools];
	}

	collapseVirtualTool(virtualToolName: string): void {
		this._expandedGroups.delete(virtualToolName);
	}

	getHiddenToolNames(virtualToolName: string): string[] {
		const vt = this._virtualToolsByName.get(virtualToolName);
		return vt ? [...vt.hiddenTools] : [];
	}

	applyGrouping(tools: readonly IQuizToolInfo[]): IQuizToolInfo[] {
		const result: IQuizToolInfo[] = [];
		const hiddenNames = new Set<string>();

		// Determine which tools are hidden behind virtual tools
		for (const vt of this._virtualToolsByName.values()) {
			if (!this._expandedGroups.has(vt.name)) {
				for (const hidden of vt.hiddenTools) {
					hiddenNames.add(hidden);
				}
			}
		}

		// Add non-hidden tools
		for (const tool of tools) {
			if (!hiddenNames.has(tool.name)) {
				result.push(tool);
			}
		}

		// Add virtual tool definitions for non-expanded groups
		for (const vt of this._virtualToolsByName.values()) {
			if (!this._expandedGroups.has(vt.name)) {
				const hasAnyHidden = vt.hiddenTools.some(name => {
					return tools.some(t => t.name === name);
				});
				if (hasAnyHidden) {
					result.push({
						name: vt.name,
						description: vt.description,
						inputSchema: vt.inputSchema as IQuizToolDefinition['inputSchema'],
						tags: ['virtual'],
					});
				}
			}
		}

		return result;
	}
}

// #endregion
