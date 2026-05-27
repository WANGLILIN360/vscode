/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region GetErrorsTool (aligned with Copilot's GetErrorsTool)

export interface IQuizGetErrorsInput {
	filePath: string;
	severity?: 'error' | 'warning' | 'info';
}

export class QuizGetErrorsTool extends QuizBuiltinTool<IQuizGetErrorsInput> {

	readonly toolName = QuizToolName.GetErrors;

	readonly definition = {
		name: QuizToolName.GetErrors,
		description: 'Get diagnostics (errors, warnings) for a file. Returns a list of diagnostic items with severity, line number, and message. Use this to check for problems after editing a file.',
		inputSchema: {
			type: 'object',
			required: ['filePath'],
			properties: {
				filePath: {
					description: 'The absolute path of the file to get diagnostics for.',
					type: 'string',
				},
				severity: {
					description: 'Filter by severity level. If not specified, all diagnostics are returned.',
					type: 'string',
					enum: ['error', 'warning', 'info'],
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGetErrorsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Diagnostics for ${parameters.filePath} would be retrieved here via IMarkerService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get errors: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizGetErrorsTool());

// #endregion

// #region SearchWorkspaceSymbolsTool (aligned with Copilot's SearchWorkspaceSymbolsTool)

export interface IQuizSearchWorkspaceSymbolsInput {
	query: string;
}

export class QuizSearchWorkspaceSymbolsTool extends QuizBuiltinTool<IQuizSearchWorkspaceSymbolsInput> {

	readonly toolName = QuizToolName.SearchWorkspaceSymbols;

	readonly definition = {
		name: QuizToolName.SearchWorkspaceSymbols,
		description: 'Search for workspace symbols (types, functions, classes, etc.) by name. Returns matching symbol names, kinds, and locations.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The search query for symbol names. Supports fuzzy matching.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizSearchWorkspaceSymbolsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Workspace symbol search results for "${parameters.query}" would be provided here via IWorkspaceSymbolService]`);
		} catch (err) {
			return quizToolResultError(`Failed to search workspace symbols: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizSearchWorkspaceSymbolsTool());

// #endregion

// #region GetScmChangesTool (aligned with Copilot's GetScmChangesTool)

export interface IQuizGetScmChangesInput {
	scmResource?: string;
}

export class QuizGetScmChangesTool extends QuizBuiltinTool<IQuizGetScmChangesInput> {

	readonly toolName = QuizToolName.GetScmChanges;

	readonly definition = {
		name: QuizToolName.GetScmChanges,
		description: 'Get the list of changed files in the current source control repository. Returns file paths with their change type (added, modified, deleted).',
		inputSchema: {
			type: 'object',
			properties: {
				scmResource: {
					description: 'Optional SCM resource URI to query. If not specified, uses the default repository.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGetScmChangesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[SCM changes would be retrieved here via ISCMService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get SCM changes: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizGetScmChangesTool());

// #endregion

// #region ViewImageTool (aligned with Copilot's ViewImageTool)

export interface IQuizViewImageInput {
	filePath: string;
}

export class QuizViewImageTool extends QuizBuiltinTool<IQuizViewImageInput> {

	readonly toolName = QuizToolName.ViewImage;

	readonly definition = {
		name: QuizToolName.ViewImage,
		description: 'View an image file. Returns a description of the image content. Supports PNG, JPEG, GIF, BMP, WebP, and SVG formats.',
		inputSchema: {
			type: 'object',
			required: ['filePath'],
			properties: {
				filePath: {
					description: 'The absolute path of the image file to view.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizViewImageInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Image content of ${parameters.filePath} would be described here via vision model]`);
		} catch (err) {
			return quizToolResultError(`Failed to view image: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizViewImageTool());

// #endregion

// #region MemoryTool (aligned with Copilot's MemoryTool)

export interface IQuizMemoryInput {
	action: 'save' | 'retrieve' | 'list' | 'delete';
	key: string;
	value?: string;
}

export class QuizMemoryTool extends QuizBuiltinTool<IQuizMemoryInput> {

	readonly toolName = QuizToolName.Memory;

	readonly definition = {
		name: QuizToolName.Memory,
		description: 'Save, retrieve, list, or delete key-value pairs for persistent memory across conversation turns. Use this to remember important context, decisions, or facts that should persist.',
		inputSchema: {
			type: 'object',
			required: ['action', 'key'],
			properties: {
				action: {
					description: 'The memory action to perform.',
					type: 'string',
					enum: ['save', 'retrieve', 'list', 'delete'],
				},
				key: {
					description: 'The key for the memory entry.',
					type: 'string',
				},
				value: {
					description: 'The value to save (required for "save" action).',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizMemoryInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			switch (parameters.action) {
				case 'save':
					return quizToolResultText(`[Memory saved: key="${parameters.key}"]`);
				case 'retrieve':
					return quizToolResultText(`[Memory retrieved: key="${parameters.key}" — value would be provided here via persistent storage]`);
				case 'list':
					return quizToolResultText(`[Memory keys would be listed here via persistent storage]`);
				case 'delete':
					return quizToolResultText(`[Memory deleted: key="${parameters.key}"]`);
				default:
					return quizToolResultError(`Unknown memory action: ${parameters.action}`);
			}
		} catch (err) {
			return quizToolResultError(`Failed to perform memory action: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizMemoryTool());

// #endregion

// #region CodebaseTool (aligned with Copilot's CodebaseTool / semantic_search)

export interface IQuizCodebaseInput {
	query: string;
}

export class QuizCodebaseTool extends QuizBuiltinTool<IQuizCodebaseInput> {

	readonly toolName = QuizToolName.Codebase;

	readonly definition = {
		name: QuizToolName.Codebase,
		description: 'Semantic search across the codebase. Finds relevant code snippets based on natural language queries. Returns matching file paths, line numbers, and code snippets with relevance scores.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The natural language search query describing the code you are looking for.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizCodebaseInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Semantic codebase search results for "${parameters.query}" would be provided here via code search service]`);
		} catch (err) {
			return quizToolResultError(`Failed to search codebase: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizCodebaseTool());

// #endregion

// #region ReadProjectStructureTool (aligned with Copilot's ReadProjectStructureTool)

export interface IQuizReadProjectStructureInput {
	path?: string;
}

export class QuizReadProjectStructureTool extends QuizBuiltinTool<IQuizReadProjectStructureInput> {

	readonly toolName = QuizToolName.ReadProjectStructure;

	readonly definition = {
		name: QuizToolName.ReadProjectStructure,
		description: 'Read the project structure (directory tree) at the given path. Returns a tree representation of files and directories.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					description: 'The absolute path to read the structure from. Defaults to workspace root.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizReadProjectStructureInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Project structure at ${parameters.path ?? 'workspace root'} would be read here via IFileService]`);
		} catch (err) {
			return quizToolResultError(`Failed to read project structure: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizReadProjectStructureTool());

// #endregion

// #region FetchWebPageTool (aligned with Copilot's FetchWebPageTool)

export interface IQuizFetchWebPageInput {
	url: string;
}

export class QuizFetchWebPageTool extends QuizBuiltinTool<IQuizFetchWebPageInput> {

	readonly toolName = QuizToolName.FetchWebPage;

	readonly definition = {
		name: QuizToolName.FetchWebPage,
		description: 'Fetch and read the content of a web page. Returns the text content of the page. Use this to access documentation, APIs, or other web resources.',
		inputSchema: {
			type: 'object',
			required: ['url'],
			properties: {
				url: {
					description: 'The URL of the web page to fetch.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizFetchWebPageInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Web page content from ${parameters.url} would be fetched here via IRequestService]`);
		} catch (err) {
			return quizToolResultError(`Failed to fetch web page: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizFetchWebPageTool());

// #endregion

// #region FindTestFilesTool (aligned with Copilot's FindTestFilesTool)

export interface IQuizFindTestFilesInput {
	path?: string;
}

export class QuizFindTestFilesTool extends QuizBuiltinTool<IQuizFindTestFilesInput> {

	readonly toolName = QuizToolName.FindTestFiles;

	readonly definition = {
		name: QuizToolName.FindTestFiles,
		description: 'Find test files in the workspace. Returns paths to files that appear to contain tests based on naming conventions and location.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					description: 'Optional path to search within. Defaults to workspace root.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizFindTestFilesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Test files at ${parameters.path ?? 'workspace root'} would be found here via IWorkspaceFolderService]`);
		} catch (err) {
			return quizToolResultError(`Failed to find test files: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizFindTestFilesTool());

// #endregion

// #region InstallExtensionTool (aligned with Copilot's InstallExtensionTool)

export interface IQuizInstallExtensionInput {
	extensionId: string;
}

export class QuizInstallExtensionTool extends QuizBuiltinTool<IQuizInstallExtensionInput> {

	readonly toolName = QuizToolName.InstallExtension;

	readonly definition = {
		name: QuizToolName.InstallExtension,
		description: 'Install a VS Code extension by its ID (e.g., "ms-python.python"). Returns confirmation of installation.',
		inputSchema: {
			type: 'object',
			required: ['extensionId'],
			properties: {
				extensionId: {
					description: 'The extension ID in the format "publisher.extension-name".',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizInstallExtensionInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Extension ${parameters.extensionId} would be installed here via IExtensionManagementService]`);
		} catch (err) {
			return quizToolResultError(`Failed to install extension: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizInstallExtensionTool());

// #endregion
