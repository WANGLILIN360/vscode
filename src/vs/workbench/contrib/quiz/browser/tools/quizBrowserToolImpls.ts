/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer tool implementations that use real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's tools/node/ directory pattern.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IMarkerService } from '../../../../../platform/markers/common/markers.js';
import { ISearchService, IFileQuery, QueryType } from '../../../../services/search/common/search.js';

// #region QuizReadFileToolImpl (browser-layer, aligned with Copilot's ReadFileTool)

const MAX_OUTPUT_LINES = 2000;

export interface IQuizReadFileInput {
	filePath: string;
	offset?: number;
	limit?: number;
}

export class QuizReadFileToolImpl extends QuizBuiltinTool<IQuizReadFileInput> {

	readonly toolName = QuizToolName.ReadFile;

	readonly definition = {
		name: QuizToolName.ReadFile,
		description: 'Read the contents of a file. Line numbers are 1-indexed. This tool will truncate its output at 2000 lines and may be called repeatedly with offset and limit parameters to read larger files in chunks. Binary files use offset/limit as byte offsets.',
		inputSchema: {
			type: 'object',
			required: ['filePath'],
			properties: {
				filePath: {
					description: 'The absolute path of the file to read.',
					type: 'string',
				},
				offset: {
					description: 'The 1-indexed line number to start reading from (for text files) or byte offset (for binary files).',
					type: 'number',
				},
				limit: {
					description: 'The maximum number of lines to read (for text files) or bytes to read (for binary files).',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizReadFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const content = await this._fileService.readFile(uri);
			const text = content.value.toString();
			const lines = text.split('\n');
			const offset = Math.max(0, (parameters.offset ?? 1) - 1);
			const limit = parameters.limit ?? MAX_OUTPUT_LINES;
			const selectedLines = lines.slice(offset, offset + limit);

			const numberedLines = selectedLines.map((line, i) => `${offset + i + 1}: ${line}`);
			const result = numberedLines.join('\n');

			const totalLines = lines.length;
			const showingLines = selectedLines.length;
			const suffix = showingLines < totalLines
				? `\n\n(showing lines ${offset + 1}-${offset + showingLines} of ${totalLines} total lines. Use offset and limit to read more.)`
				: '';

			return quizToolResultText(result + suffix);
		} catch (err) {
			return quizToolResultError(`Failed to read file: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizListDirToolImpl (browser-layer, aligned with Copilot's ListDirTool)

export interface IQuizListDirInput {
	path: string;
}

export class QuizListDirToolImpl extends QuizBuiltinTool<IQuizListDirInput> {

	readonly toolName = QuizToolName.ListDirectory;

	readonly definition = {
		name: QuizToolName.ListDirectory,
		description: 'List the contents of a directory. Returns file and subdirectory names with their types.',
		inputSchema: {
			type: 'object',
			required: ['path'],
			properties: {
				path: {
					description: 'The absolute path of the directory to list.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizListDirInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.path);
			const result = await this._fileService.resolve(uri);
			const entries = (result.children ?? []).map(child => {
				const type = child.isDirectory ? 'DIR ' : 'FILE';
				const name = child.name;
				return `${type}  ${name}`;
			});
			return quizToolResultText(entries.join('\n') || '(empty directory)');
		} catch (err) {
			return quizToolResultError(`Failed to list directory: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizFindFilesToolImpl (browser-layer, aligned with Copilot's FindFilesTool)

export interface IQuizFindFilesInput {
	pattern: string;
	excludePatterns?: string[];
}

export class QuizFindFilesToolImpl extends QuizBuiltinTool<IQuizFindFilesInput> {

	readonly toolName = QuizToolName.FindFiles;

	readonly definition = {
		name: QuizToolName.FindFiles,
		description: 'Find files by name pattern using glob syntax. Returns matching file paths.',
		inputSchema: {
			type: 'object',
			required: ['pattern'],
			properties: {
				pattern: {
					description: 'The glob pattern to search for (e.g., "**/*.ts").',
					type: 'string',
				},
				excludePatterns: {
					description: 'Glob patterns to exclude from the search.',
					type: 'array',
					items: { type: 'string' },
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _searchService: ISearchService,
		private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	override async invoke(parameters: IQuizFindFilesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const folderQueries = this._workspaceContextService.getWorkspace().folders.map(f => ({ folder: f.uri }));
			const query: IFileQuery = {
				type: QueryType.File,
				folderQueries,
				filePattern: parameters.pattern,
				excludePattern: parameters.excludePatterns?.reduce<Record<string, boolean>>((acc, p) => { acc[p] = true; return acc; }, {}),
				maxResults: 100,
			};

			const result = await this._searchService.fileSearch(query, token);

			if (!result.results.length) {
				return quizToolResultText('No files found matching pattern.');
			}

			const paths = result.results.map(r => r.resource.fsPath);
			return quizToolResultText(paths.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to find files: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizGetErrorsToolImpl (browser-layer, aligned with Copilot's GetErrorsTool)

export interface IQuizGetErrorsInput {
	filePath: string;
	severity?: 'error' | 'warning' | 'info';
}

export class QuizGetErrorsToolImpl extends QuizBuiltinTool<IQuizGetErrorsInput> {

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

	constructor(
		private readonly _markerService: IMarkerService,
	) {
		super();
	}

	override async invoke(parameters: IQuizGetErrorsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const markers = this._markerService.read({ resource: uri });

			const severityMap: Record<number, string> = { 1: 'error', 2: 'warning', 3: 'info', 4: 'info' };
			const severityFilter = parameters.severity;

			const filtered = severityFilter
				? markers.filter(m => severityMap[m.severity] === severityFilter)
				: markers;

			if (filtered.length === 0) {
				return quizToolResultText('No diagnostics found for this file.');
			}

			const lines = filtered.map(m => {
				const sev = severityMap[m.severity] ?? 'unknown';
				const line = m.startLineNumber;
				return `[${sev}] line ${line}: ${m.message}`;
			});
			return quizToolResultText(lines.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to get errors: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizCreateFileToolImpl (browser-layer, aligned with Copilot's CreateFileTool)

export interface IQuizCreateFileInput {
	filePath: string;
	content: string;
}

export class QuizCreateFileToolImpl extends QuizBuiltinTool<IQuizCreateFileInput> {

	readonly toolName = QuizToolName.CreateFile;

	readonly definition = {
		name: QuizToolName.CreateFile,
		description: 'Create a new file with the specified content.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'content'],
			properties: {
				filePath: {
					description: 'The absolute path for the new file.',
					type: 'string',
				},
				content: {
					description: 'The initial content for the new file.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizCreateFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			await this._fileService.writeFile(uri, VSBuffer.fromString(parameters.content));
			return quizToolResultText(`File created successfully: ${parameters.filePath}`);
		} catch (err) {
			return quizToolResultError(`Failed to create file: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizCreateDirectoryToolImpl (browser-layer, aligned with Copilot's CreateDirectoryTool)

export interface IQuizCreateDirectoryInput {
	path: string;
}

export class QuizCreateDirectoryToolImpl extends QuizBuiltinTool<IQuizCreateDirectoryInput> {

	readonly toolName = QuizToolName.CreateDirectory;

	readonly definition = {
		name: QuizToolName.CreateDirectory,
		description: 'Create a new directory at the specified path.',
		inputSchema: {
			type: 'object',
			required: ['path'],
			properties: {
				path: {
					description: 'The absolute path for the new directory.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizCreateDirectoryInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.path);
			await this._fileService.createFolder(uri);
			return quizToolResultText(`Directory created: ${parameters.path}`);
		} catch (err) {
			return quizToolResultError(`Failed to create directory: ${String(err)}`);
		}
	}
}

// #endregion

/**
 * Register all browser-layer tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization
 * in the browser contribution.
 */
export function registerQuizBrowserTools(
	fileService: IFileService,
	markerService: IMarkerService,
	searchService: ISearchService,
	workspaceContextService: IWorkspaceContextService,
): void {
	QuizBuiltinToolRegistry.register(new QuizReadFileToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizListDirToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizFindFilesToolImpl(searchService, workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizGetErrorsToolImpl(markerService));
	QuizBuiltinToolRegistry.register(new QuizCreateFileToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizCreateDirectoryToolImpl(fileService));
}
