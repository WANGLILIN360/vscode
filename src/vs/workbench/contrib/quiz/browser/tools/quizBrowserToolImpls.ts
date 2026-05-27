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
import { ISearchService, IFileQuery, QueryType } from '../../../../services/search/common/search.js';
import { MAX_OUTPUT_LINES, MAX_LINE_LENGTH, MAX_HEXDUMP_BYTES, knownBinaryExtensions, isBinaryContent, formatHexdump } from '../../common/tools/quizBinaryUtils.js';

// #region QuizReadFileToolImpl (browser-layer, aligned with Copilot's ReadFileTool)

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
					description: 'Optional: the 1-based line number to start reading from. Only use this if the file is too large to read at once. If not specified, the file will be read from the beginning.',
					type: 'number',
				},
				limit: {
					description: 'Optional: the maximum number of lines to read. Only use this together with `offset` if the file is too large to read at once.',
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

			// --- Binary file detection (aligned with Copilot's hexdumpIfBinary) ---
			const extDot = uri.path.lastIndexOf('.');
			const ext = extDot >= 0 ? uri.path.substring(extDot).toLowerCase() : '';
			const data = content.value.buffer;

			if (isBinaryContent(data) || knownBinaryExtensions.has(ext)) {
				// Return hexdump for binary files (aligned with Copilot's BinaryFileHexdump)
				const startByte = parameters.offset ?? 0;
				const endByte = parameters.limit !== undefined
					? startByte + parameters.limit
					: startByte + MAX_HEXDUMP_BYTES;
				const clampedEnd = Math.min(endByte, data.length, startByte + MAX_HEXDUMP_BYTES);
				const truncated = clampedEnd < data.length;
				const hexdump = formatHexdump(data, startByte, clampedEnd - startByte);

				let result = `Binary file: ${parameters.filePath}\nTotal size: ${data.length} bytes\n`;
				result += `Showing bytes ${startByte}-${clampedEnd}:\n\`\`\`\n${hexdump}\n\`\`\``;
				if (truncated) {
					result += `\n[File content truncated at byte ${clampedEnd}. Use ${QuizToolName.ReadFile} with offset/limit parameters to view more.]`;
				}
				return quizToolResultText(result);
			}

			// --- Text file handling ---
			const text = content.value.toString();

			// Empty file handling (aligned with Copilot's ReadFileResult)
			if (text.length === 0) {
				return quizToolResultText(`The file \`${parameters.filePath}\` exists, but is empty.`);
			}
			if (text.trim().length === 0) {
				return quizToolResultText(`The file \`${parameters.filePath}\` exists, but contains only whitespace.`);
			}

			const lines = text.split('\n');
			const totalLines = lines.length;

			// Offset validation (aligned with Copilot's getParamRanges)
			const startLine = Math.max(1, parameters.offset ?? 1);
			if (startLine > totalLines) {
				return quizToolResultError(`Invalid offset ${startLine}: file only has ${totalLines} line${totalLines === 1 ? '' : 's'}. Line numbers are 1-indexed.`);
			}

			const limit = Math.min(parameters.limit ?? MAX_OUTPUT_LINES, MAX_OUTPUT_LINES);
			const endLine = Math.min(startLine + limit, totalLines + 1);
			const selectedLines = lines.slice(startLine - 1, endLine - 1);

			// Line length truncation (aligned with Copilot's MAX_LINE_LENGTH)
			let hadLongLines = false;
			const numberedLines = selectedLines.map((line, i) => {
				if (line.length > MAX_LINE_LENGTH) {
					hadLongLines = true;
					return `${startLine + i}: ${line.slice(0, MAX_LINE_LENGTH)} [truncated]`;
				}
				return `${startLine + i}: ${line}`;
			});

			let result = numberedLines.join('\n');

			if (hadLongLines) {
				result += `\n[One or more long lines were truncated at ${MAX_LINE_LENGTH} characters]`;
			}

			// Truncation hint (aligned with Copilot's truncation messaging)
			const showingLines = selectedLines.length;
			const truncated = endLine - 1 < totalLines;
			if (truncated) {
				result += `\n[File content truncated at line ${endLine - 1}. Use ${QuizToolName.ReadFile} with offset/limit parameters to view more. Total lines: ${totalLines}]`;
			} else if (startLine > 1 || showingLines < totalLines) {
				result += `\n\n(showing lines ${startLine}-${startLine + showingLines - 1} of ${totalLines} total lines)`;
			}

			return quizToolResultText(result);
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
			const exists = await this._fileService.exists(uri);

			// Create parent directories if needed (aligned with Copilot's createFileTool)
			const dirUri = URI.joinPath(uri, '..');
			try {
				await this._fileService.createFolder(dirUri);
			} catch {
				// Directory may already exist
			}

			await this._fileService.writeFile(uri, VSBuffer.fromString(parameters.content));
			return quizToolResultText(exists
				? `File overwritten: ${parameters.filePath}`
				: `File created: ${parameters.filePath}`);
		} catch (err) {
			return quizToolResultError(`Failed to create file: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizCreateFileInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const uri = URI.file(parameters.filePath);
		const exists = await this._fileService.exists(uri);
		return {
			confirmationMessages: exists ? {
				title: 'Overwrite existing file?',
				message: `File \`${parameters.filePath}\` already exists. Overwrite it?`,
			} : {
				title: 'Create file?',
				message: `Create \`${parameters.filePath}\`?`,
			},
			invocationMessage: `Creating ${parameters.filePath}`,
		};
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
	_searchService: ISearchService,
	_workspaceContextService: IWorkspaceContextService,
): void {
	QuizBuiltinToolRegistry.register(new QuizReadFileToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizListDirToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizFindFilesToolImpl(_searchService, _workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizCreateFileToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizCreateDirectoryToolImpl(fileService));
	// Note: GetErrorsTool is registered via registerQuizBrowserWorkspaceTools
}
