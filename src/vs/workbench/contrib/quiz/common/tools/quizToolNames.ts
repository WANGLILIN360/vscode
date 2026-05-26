/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @generated DO NOT EDIT — this file is auto-generated from Copilot's toolNames.ts. Edit the source instead.

import { cloneAndChange } from '../../../../../base/common/objects.js';

// #region ToolName enum (aligned with Copilot's ToolName)

/**
 * Internal tool names sent to the model API.
 * These are the wire-format names used in tool call requests/responses.
 */
export enum QuizToolName {
	ApplyPatch = 'apply_patch',
	Codebase = 'semantic_search',
	VSCodeAPI = 'get_vscode_api',
	FindFiles = 'file_search',
	FindTextInFiles = 'grep_search',
	ReadFile = 'read_file',
	ViewImage = 'view_image',
	ListDirectory = 'list_dir',
	GetErrors = 'get_errors',
	GetScmChanges = 'get_changed_files',
	ReadProjectStructure = 'read_project_structure',
	CreateNewWorkspace = 'create_new_workspace',
	CreateNewJupyterNotebook = 'create_new_jupyter_notebook',
	SearchWorkspaceSymbols = 'search_workspace_symbols',
	EditFile = 'insert_edit_into_file',
	CreateFile = 'create_file',
	ReplaceString = 'replace_string_in_file',
	MultiReplaceString = 'multi_replace_string_in_file',
	EditNotebook = 'edit_notebook_file',
	RunNotebookCell = 'run_notebook_cell',
	GetNotebookSummary = 'copilot_getNotebookSummary',
	ReadCellOutput = 'read_notebook_cell_output',
	InstallExtension = 'install_extension',
	FetchWebPage = 'fetch_webpage',
	Memory = 'memory',
	FindTestFiles = 'test_search',
	GithubSemanticRepoSearch = 'github_repo',
	GithubTextSearch = 'github_text_search',
	CreateDirectory = 'create_directory',
	RunVscodeCmd = 'run_vscode_command',
	CoreManageTodoList = 'manage_todo_list',
	CoreRunInTerminal = 'run_in_terminal',
	CoreGetTerminalOutput = 'get_terminal_output',
	CoreSendToTerminal = 'send_to_terminal',
	CoreKillTerminal = 'kill_terminal',
	CoreTerminalSelection = 'terminal_selection',
	CoreTerminalLastCommand = 'terminal_last_command',
	CoreCreateAndRunTask = 'create_and_run_task',
	CoreRunTask = 'run_task',
	CoreGetTaskOutput = 'get_task_output',
	CoreRunTest = 'runTests',
	CoreTestFailure = 'testFailure',
	EditFilesPlaceholder = 'edit_files',
	CoreRunSubagent = 'runSubagent',
	CoreConfirmationTool = 'vscode_get_confirmation',
	CoreConfirmationToolWithOptions = 'vscode_get_confirmation_with_options',
	CoreReviewPlan = 'vscode_reviewPlan',
	CoreTerminalConfirmationTool = 'vscode_get_terminal_confirmation',
	SearchSubagent = 'search_subagent',
	ExploreSubagent = 'explore_subagent',
	CoreAskQuestions = 'vscode_askQuestions',
	SwitchAgent = 'switch_agent',
	ToolSearch = 'tool_search',
	ResolveMemoryFileUri = 'resolve_memory_file_uri',
	ExecutionSubagent = 'execution_subagent',
	Skill = 'skill',
	SessionStoreSql = 'session_store_sql',
	CoreOpenBrowserPage = 'open_browser_page',
	CoreClickElement = 'click_element',
	CoreScreenshotPage = 'screenshot_page',
	CoreNavigatePage = 'navigate_page',
	CoreReadPage = 'read_page',
	CoreHoverElement = 'hover_element',
	CoreDragElement = 'drag_element',
	CoreTypeInPage = 'type_in_page',
	CoreHandleDialog = 'handle_dialog',
	CoreRunPlaywrightCode = 'run_playwright_code',
}

// #endregion

// #region ContributedToolName enum (aligned with Copilot's ContributedToolName)

/**
 * External tool names as they appear in the VS Code tool picker UI.
 * These are prefixed with `quiz_` to namespace Quiz's contributed tools.
 */
export enum QuizContributedToolName {
	ApplyPatch = 'quiz_applyPatch',
	Codebase = 'quiz_searchCodebase',
	SearchWorkspaceSymbols = 'quiz_searchWorkspaceSymbols',
	VSCodeAPI = 'quiz_getVSCodeAPI',
	FindFiles = 'quiz_findFiles',
	FindTextInFiles = 'quiz_findTextInFiles',
	ReadFile = 'quiz_readFile',
	ViewImage = 'quiz_viewImage',
	ListDirectory = 'quiz_listDirectory',
	GetErrors = 'quiz_getErrors',
	GetScmChanges = 'quiz_getChangedFiles',
	ReadProjectStructure = 'quiz_readProjectStructure',
	CreateNewWorkspace = 'quiz_createNewWorkspace',
	CreateNewJupyterNotebook = 'quiz_createNewJupyterNotebook',
	EditFile = 'quiz_insertEdit',
	CreateFile = 'quiz_createFile',
	ReplaceString = 'quiz_replaceString',
	MultiReplaceString = 'quiz_multiReplaceString',
	EditNotebook = 'quiz_editNotebook',
	RunNotebookCell = 'quiz_runNotebookCell',
	GetNotebookSummary = 'quiz_getNotebookSummary',
	ReadCellOutput = 'quiz_readNotebookCellOutput',
	InstallExtension = 'quiz_installExtension',
	FetchWebPage = 'quiz_fetchWebPage',
	Memory = 'quiz_memory',
	FindTestFiles = 'quiz_findTestFiles',
	GithubSemanticRepoSearch = 'quiz_githubRepo',
	GithubTextSearch = 'quiz_githubTextSearch',
	CreateAndRunTask = 'quiz_createAndRunTask',
	CreateDirectory = 'quiz_createDirectory',
	RunVscodeCmd = 'quiz_runVscodeCommand',
	EditFilesPlaceholder = 'quiz_editFiles',
	/** @deprecated moving to core soon */
	RunTests = 'quiz_runTests1',
	SwitchAgent = 'quiz_switchAgent',
	ResolveMemoryFileUri = 'quiz_resolveMemoryFileUri',
	SessionStoreSql = 'quiz_sessionStoreSql',
}

// #endregion

// #region ToolCategory enum (aligned with Copilot's ToolCategory)

/**
 * Categories for tool grouping in the virtual tools system.
 */
export enum QuizToolCategory {
	JupyterNotebook = 'Jupyter Notebook Tools',
	WebInteraction = 'Web Interaction',
	VSCodeInteraction = 'VS Code Interaction',
	Testing = 'Testing',
	RedundantButSpecific = 'Redundant but Specific',
	Core = 'Core',
}

// #endregion

// #region Tool name mapping (aligned with Copilot's toolNameToContributedToolNames)

const _toolNameToContributed = new Map<QuizToolName, QuizContributedToolName>();
const _contributedToToolName = new Map<QuizContributedToolName, QuizToolName>();
for (const [contributedNameKey, contributedName] of Object.entries(QuizContributedToolName)) {
	const toolName = QuizToolName[contributedNameKey as keyof typeof QuizToolName];
	if (toolName) {
		_toolNameToContributed.set(toolName, contributedName);
		_contributedToToolName.set(contributedName, toolName);
	}
}

/**
 * Get the contributed (UI-visible) tool name from an internal tool name.
 */
export function getQuizContributedToolName(name: string | QuizToolName): string | QuizContributedToolName {
	return _toolNameToContributed.get(name as QuizToolName) ?? name;
}

/**
 * Get the internal tool name from a contributed (UI-visible) tool name.
 */
export function getQuizToolName(name: string | QuizContributedToolName): string | QuizToolName {
	return _contributedToToolName.get(name as QuizContributedToolName) ?? name;
}

export function mapQuizContributedToolNamesInString(str: string): string {
	_contributedToToolName.forEach((value, key) => {
		const re = new RegExp(`\\b${key}\\b`, 'g');
		str = str.replace(re, value);
	});
	return str;
}

export function mapQuizContributedToolNamesInSchema(inputSchema: object): object {
	return cloneAndChange(inputSchema, value => typeof value === 'string' ? mapQuizContributedToolNamesInString(value) : undefined);
}

// #endregion

// #region BYOK edit tool name mapping (aligned with Copilot's byokEditToolNamesToToolNames)

/**
 * Maps BYOK (Bring Your Own Key) edit tool preference names to QuizToolName values.
 * Used when a BYOK model specifies its preferred edit tool format.
 */
export const quizByokEditToolNamesToToolNames = {
	'find-replace': QuizToolName.ReplaceString,
	'multi-find-replace': QuizToolName.MultiReplaceString,
	'apply-patch': QuizToolName.ApplyPatch,
	'code-rewrite': QuizToolName.EditFile,
} as const;

// #endregion

// #region Tool categories mapping (aligned with Copilot's toolCategories)

/**
 * Type-safe mapping of all QuizToolName values to their categories.
 * When new tools are added, they must be categorized here.
 */
export const quizToolCategories: Record<QuizToolName, QuizToolCategory> = {
	// Core tools (not grouped - expanded by default)
	[QuizToolName.Codebase]: QuizToolCategory.Core,
	[QuizToolName.FindTextInFiles]: QuizToolCategory.Core,
	[QuizToolName.ReadFile]: QuizToolCategory.Core,
	[QuizToolName.ViewImage]: QuizToolCategory.Core,
	[QuizToolName.CreateFile]: QuizToolCategory.Core,
	[QuizToolName.ApplyPatch]: QuizToolCategory.Core,
	[QuizToolName.ReplaceString]: QuizToolCategory.Core,
	[QuizToolName.EditFile]: QuizToolCategory.Core,
	[QuizToolName.CoreRunInTerminal]: QuizToolCategory.Core,
	[QuizToolName.ListDirectory]: QuizToolCategory.Core,
	[QuizToolName.CoreGetTerminalOutput]: QuizToolCategory.Core,
	[QuizToolName.CoreSendToTerminal]: QuizToolCategory.Core,
	[QuizToolName.CoreKillTerminal]: QuizToolCategory.Core,
	[QuizToolName.CoreManageTodoList]: QuizToolCategory.Core,
	[QuizToolName.MultiReplaceString]: QuizToolCategory.Core,
	[QuizToolName.FindFiles]: QuizToolCategory.Core,
	[QuizToolName.CreateDirectory]: QuizToolCategory.Core,
	[QuizToolName.ReadProjectStructure]: QuizToolCategory.Core,
	[QuizToolName.CoreRunSubagent]: QuizToolCategory.Core,
	[QuizToolName.SearchSubagent]: QuizToolCategory.Core,
	[QuizToolName.ExploreSubagent]: QuizToolCategory.Core,
	[QuizToolName.ExecutionSubagent]: QuizToolCategory.Core,
	[QuizToolName.CoreRunTask]: QuizToolCategory.Core,
	[QuizToolName.CoreGetTaskOutput]: QuizToolCategory.Core,
	[QuizToolName.EditFilesPlaceholder]: QuizToolCategory.Core,
	[QuizToolName.ToolSearch]: QuizToolCategory.Core,
	[QuizToolName.ResolveMemoryFileUri]: QuizToolCategory.Core,
	[QuizToolName.Skill]: QuizToolCategory.Core,
	[QuizToolName.SessionStoreSql]: QuizToolCategory.Core,

	// Jupyter Notebook Tools
	[QuizToolName.CreateNewJupyterNotebook]: QuizToolCategory.JupyterNotebook,
	[QuizToolName.EditNotebook]: QuizToolCategory.JupyterNotebook,
	[QuizToolName.RunNotebookCell]: QuizToolCategory.JupyterNotebook,
	[QuizToolName.GetNotebookSummary]: QuizToolCategory.JupyterNotebook,
	[QuizToolName.ReadCellOutput]: QuizToolCategory.JupyterNotebook,

	// Web Interaction
	[QuizToolName.FetchWebPage]: QuizToolCategory.WebInteraction,
	[QuizToolName.GithubSemanticRepoSearch]: QuizToolCategory.WebInteraction,
	[QuizToolName.GithubTextSearch]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreOpenBrowserPage]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreClickElement]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreScreenshotPage]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreNavigatePage]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreReadPage]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreHoverElement]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreDragElement]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreTypeInPage]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreHandleDialog]: QuizToolCategory.WebInteraction,
	[QuizToolName.CoreRunPlaywrightCode]: QuizToolCategory.WebInteraction,

	// VS Code Interaction
	[QuizToolName.SearchWorkspaceSymbols]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.GetErrors]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.VSCodeAPI]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.GetScmChanges]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CreateNewWorkspace]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.InstallExtension]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreCreateAndRunTask]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.RunVscodeCmd]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreTerminalSelection]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreTerminalLastCommand]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreConfirmationTool]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreConfirmationToolWithOptions]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreReviewPlan]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreTerminalConfirmationTool]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.CoreAskQuestions]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.SwitchAgent]: QuizToolCategory.VSCodeInteraction,
	[QuizToolName.Memory]: QuizToolCategory.VSCodeInteraction,

	// Testing
	[QuizToolName.FindTestFiles]: QuizToolCategory.Testing,
	[QuizToolName.CoreRunTest]: QuizToolCategory.Testing,
	[QuizToolName.CoreTestFailure]: QuizToolCategory.Testing,
} as const;

/**
 * Agentic browser tool IDs that are NOT the open_browser_page tool.
 */
export const quizAgenticBrowserTools = [
	QuizToolName.CoreClickElement,
	QuizToolName.CoreScreenshotPage,
	QuizToolName.CoreNavigatePage,
	QuizToolName.CoreReadPage,
	QuizToolName.CoreHoverElement,
	QuizToolName.CoreDragElement,
	QuizToolName.CoreTypeInPage,
	QuizToolName.CoreHandleDialog,
	QuizToolName.CoreRunPlaywrightCode,
] as const;

/**
 * Get the category for a tool.
 */
const _hasOwnProperty = Object.prototype.hasOwnProperty;

export function getQuizToolCategory(toolName: string): QuizToolCategory | undefined {
	return _hasOwnProperty.call(quizToolCategories, toolName) ? quizToolCategories[toolName as QuizToolName] : undefined;
}

/**
 * Get all tools for a specific category.
 */
export function getQuizToolsForCategory(category: QuizToolCategory): string[] {
	const result: string[] = [];
	for (const [toolName, toolCategory] of Object.entries(quizToolCategories)) {
		if (toolCategory === category) {
			result.push(toolName);
		}
	}
	return result;
}

// #endregion
