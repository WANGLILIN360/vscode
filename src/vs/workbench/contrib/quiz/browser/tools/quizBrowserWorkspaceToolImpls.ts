/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer workspace tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's getErrorsTool.tsx, scmChangesTool.tsx, codebaseTool.tsx, etc.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IMarkerService } from '../../../../../platform/markers/common/markers.js';
import { ISearchService, IFileQuery, QueryType, IFileMatch, ITextSearchMatch, resultIsMatch } from '../../../../services/search/common/search.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { ISCMService, ISCMRepository } from '../../../scm/common/scm.js';
import { VSBuffer, streamToBuffer } from '../../../../../base/common/buffer.js';
import { IExtensionManagementService, IExtensionGalleryService } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { getImageMimeType, MAX_IMAGE_FILE_SIZE } from '../../common/tools/quizImageToolUtils.js';
import { IQuizMemoryCleanupService } from '../../common/tools/quizMemoryCleanupService.js';
import { IWorkspaceSymbol } from '../../../search/common/search.js';

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

// #region QuizSearchWorkspaceSymbolsToolImpl (browser-layer, aligned with Copilot's SearchWorkspaceSymbolsTool)

export interface IQuizSearchWorkspaceSymbolsInput {
	symbolName: string;
}

export class QuizSearchWorkspaceSymbolsToolImpl extends QuizBuiltinTool<IQuizSearchWorkspaceSymbolsInput> {

	readonly toolName = QuizToolName.SearchWorkspaceSymbols;

	readonly definition = {
		name: QuizToolName.SearchWorkspaceSymbols,
		description: 'Search for workspace symbols (types, functions, classes, etc.) by name. Returns matching symbol names, kinds, and locations.',
		inputSchema: {
			type: 'object',
			required: ['symbolName'],
			properties: {
				symbolName: {
					description: 'The search query for symbol names. Supports fuzzy matching.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _commandService: ICommandService,
	) {
		super();
	}

	override async invoke(parameters: IQuizSearchWorkspaceSymbolsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Use VS Code's workspace symbol search via command service
			// Aligned with Copilot's SearchWorkspaceSymbolsTool which uses ILanguageFeaturesService.getWorkspaceSymbols
			const symbols = await this._commandService.executeCommand(
				'vscode.executeWorkspaceSymbolProvider',
				parameters.symbolName
			);

			const symbolArray: IWorkspaceSymbol[] = Array.isArray(symbols) ? symbols : [];

			if (symbolArray.length === 0) {
				return quizToolResultText(`No workspace symbols found for "${parameters.symbolName}"`);
			}

			// Limit to 20 results — aligned with Copilot's SearchWorkspaceSymbolsTool
			const limited = symbolArray.slice(0, 20);
			const maxResultsText = symbolArray.length > 20
				? ` (additional ${symbolArray.length - limited.length} results omitted)`
				: '';

			const lines: string[] = [];
			lines.push(`${symbolArray.length} total result${symbolArray.length === 1 ? '' : 's'}${maxResultsText}`);

			for (const s of limited) {
				const uri = s.location?.uri?.fsPath ?? s.location?.uri?.toString() ?? '';
				const startLine = s.location?.range?.startLineNumber ?? '';
				const endLine = s.location?.range?.endLineNumber ?? '';
				const containerName = s.containerName ? `, containing symbol: ${s.containerName}` : '';
				lines.push(`From ${uri}, lines ${startLine} to ${endLine}: Symbol: ${s.name}${containerName}`);
			}

			return quizToolResultText(lines.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to search workspace symbols: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizSearchWorkspaceSymbolsInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			invocationMessage: `Searching for \`${parameters.symbolName}\``,
		};
	}
}

// #endregion

// #region QuizGetScmChangesToolImpl (browser-layer, aligned with Copilot's GetScmChangesTool)

export interface IQuizGetScmChangesInput {
	scmResource?: string;
}

export class QuizGetScmChangesToolImpl extends QuizBuiltinTool<IQuizGetScmChangesInput> {

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

	constructor(
		private readonly _scmService: ISCMService,
	) {
		super();
	}

	override async invoke(parameters: IQuizGetScmChangesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const repos = Array.from(this._scmService.repositories);
			if (repos.length === 0) {
				return quizToolResultText('No source control repositories found.');
			}

			const repo = parameters.scmResource
				? repos.find((r: ISCMRepository) => r.provider.rootUri?.toString() === parameters.scmResource) ?? repos[0]
				: repos[0];

			const groups = repo.provider.groups;
			const changes: string[] = [];

			for (const group of groups) {
				const resources = group.resources;
				for (const state of resources) {
					const uri = state.sourceUri.fsPath;
					const type = state.decorations?.tooltip ?? 'modified';
					changes.push(`[${type}] ${uri}`);
				}
			}

			if (changes.length === 0) {
				return quizToolResultText('No changes found in the repository.');
			}

			return quizToolResultText(changes.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to get SCM changes: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizViewImageToolImpl (browser-layer, aligned with Copilot's ViewImageTool)

export interface IQuizViewImageInput {
	filePath: string;
}

export class QuizViewImageToolImpl extends QuizBuiltinTool<IQuizViewImageInput> {

	readonly toolName = QuizToolName.ViewImage;

	readonly definition = {
		name: QuizToolName.ViewImage,
		description: 'View an image file. Returns the image data for the model to analyze. Supports PNG, JPEG, GIF, and WebP formats. Use read_file for non-image files.',
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

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizViewImageInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);

			// Validate MIME type — aligned with Copilot's ViewImageTool.assertImageFile
			const imageMimeType = getImageMimeType(uri);
			if (!imageMimeType) {
				return quizToolResultError(`Cannot view ${parameters.filePath} with ${QuizToolName.ViewImage}. Use ${QuizToolName.ReadFile} for non-image files.`);
			}

			// Check file size — aligned with Copilot's MAX_IMAGE_FILE_SIZE (20MB)
			const stat = await this._fileService.stat(uri);
			if (stat.size > MAX_IMAGE_FILE_SIZE) {
				return quizToolResultText(`Cannot view image file ${parameters.filePath}: file size (${Math.round(stat.size / (1024 * 1024))}MB) exceeds the maximum allowed size of ${Math.round(MAX_IMAGE_FILE_SIZE / (1024 * 1024))}MB.`);
			}

			// Read image binary data — aligned with Copilot's ViewImageTool.invoke
			const content = await this._fileService.readFile(uri);
			const data = content.value;

			// Return image data for the model to analyze
			// In the browser layer, we return the raw image data as base64 for consumption
			// by the chat infrastructure (which converts to LanguageModelDataPart.image)
			const base64 = encodeBase64(data);
			return {
				text: `Image: ${parameters.filePath} (${imageMimeType}, ${stat.size} bytes)`,
				error: false,
				imageData: {
					base64,
					mimeType: imageMimeType,
				},
			};
		} catch (err) {
			return quizToolResultError(`Failed to view image: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizViewImageInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const uri = URI.file(parameters.filePath);
		const imageMimeType = getImageMimeType(uri);
		if (!imageMimeType) {
			throw new Error(`Cannot view ${parameters.filePath} with ${QuizToolName.ViewImage}. Use ${QuizToolName.ReadFile} for non-image files.`);
		}

		return {
			invocationMessage: `Viewing image ${parameters.filePath}`,
		};
	}
}

function encodeBase64(data: VSBuffer): string {
	let binary = '';
	for (let i = 0; i < data.byteLength; i++) {
		binary += String.fromCharCode(data.buffer[i]);
	}
	return btoa(binary);
}

// #endregion

// #region QuizMemoryToolImpl (browser-layer, aligned with Copilot's MemoryTool)

const MEMORY_BASE_DIR = 'memory-tool/memories';
const REPO_PATH_PREFIX = '/memories/repo';
const SESSION_PATH_PREFIX = '/memories/session';

type MemoryScope = 'user' | 'session' | 'repo';

interface IMemoryViewParams {
	command: 'view';
	path: string;
	view_range?: [number, number];
}

interface IMemoryCreateParams {
	command: 'create';
	path: string;
	file_text: string;
}

interface IMemoryStrReplaceParams {
	command: 'str_replace';
	path: string;
	old_str: string;
	new_str: string;
}

interface IMemoryInsertParams {
	command: 'insert';
	path: string;
	insert_line: number;
	insert_text?: string;
	/** Models sometimes send `new_str` instead of `insert_text` */
	new_str?: string;
}

interface IMemoryDeleteParams {
	command: 'delete';
	path: string;
}

interface IMemoryRenameParams {
	command: 'rename';
	old_path?: string;
	new_path: string;
	/** Models sometimes send `path` instead of `old_path` */
	path?: string;
}

type IQuizMemoryInput = IMemoryViewParams | IMemoryCreateParams | IMemoryStrReplaceParams | IMemoryInsertParams | IMemoryDeleteParams | IMemoryRenameParams;

function normalizePath(path: string): string {
	return path.endsWith('/') ? path : path + '/';
}

function isMemoriesRoot(path: string): boolean {
	return normalizePath(path) === '/memories/';
}

function validatePath(path: string): string | undefined {
	if (!normalizePath(path).startsWith('/memories/')) {
		return 'Error: All memory paths must start with /memories/';
	}
	if (path.includes('..')) {
		return 'Error: Path traversal is not allowed';
	}
	const segments = path.split('/').filter(s => s.length > 0);
	if (segments.some(s => s === '.')) {
		return 'Error: Path traversal is not allowed';
	}
	if (segments[0] !== 'memories') {
		return 'Error: All memory paths must start with /memories/';
	}
	return undefined;
}

function isRepoPath(path: string): boolean {
	return path === REPO_PATH_PREFIX || path.startsWith(REPO_PATH_PREFIX + '/');
}

function isSessionPath(path: string): boolean {
	return path === SESSION_PATH_PREFIX || path.startsWith(SESSION_PATH_PREFIX + '/');
}

function formatLineNumber(line: number): string {
	return String(line).padStart(6, ' ');
}

function formatFileContent(path: string, content: string): string {
	const lines = content.split('\n');
	const numbered = lines.map((line, i) => `${formatLineNumber(i + 1)}\t${line}`);
	return `Here's the content of ${path} with line numbers:\n${numbered.join('\n')}`;
}

function makeSnippet(fileContent: string, editLine: number, path: string): string {
	const lines = fileContent.split('\n');
	const snippetRadius = 4;
	const start = Math.max(0, editLine - 1 - snippetRadius);
	const end = Math.min(lines.length, editLine - 1 + snippetRadius + 1);
	const snippet = lines.slice(start, end);
	const numbered = snippet.map((line, i) => `${formatLineNumber(start + i + 1)}\t${line}`);
	return `The memory file has been edited. Here's the result of running \`cat -n\` on a snippet of ${path}:\n${numbered.join('\n')}`;
}

export class QuizMemoryToolImpl extends QuizBuiltinTool<IQuizMemoryInput> {

	readonly toolName = QuizToolName.Memory;

	readonly definition = {
		name: QuizToolName.Memory,
		description: 'Persistent memory tool that saves, retrieves, and manages files under /memories/. Supports three scopes: user (/memories/foo.md), session (/memories/session/foo.md), and repo (/memories/repo/foo.md). Commands: view, create, str_replace, insert, delete, rename. Use this to remember important context across conversation turns.',
		inputSchema: {
			type: 'object',
			required: ['command', 'path'],
			properties: {
				command: {
					description: 'The memory command to execute.',
					type: 'string',
					enum: ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'],
				},
				path: {
					description: 'The memory path (must start with /memories/).',
					type: 'string',
				},
				file_text: {
					description: 'Content for the "create" command.',
					type: 'string',
				},
				view_range: {
					description: 'Line range [start, end] for the "view" command.',
					type: 'array',
					items: { type: 'number' },
				},
				old_str: {
					description: 'String to replace for "str_replace" command.',
					type: 'string',
				},
				new_str: {
					description: 'Replacement string for "str_replace" or "insert" command.',
					type: 'string',
				},
				insert_line: {
					description: 'Line number for "insert" command (0-indexed).',
					type: 'number',
				},
				old_path: {
					description: 'Source path for "rename" command.',
					type: 'string',
				},
				new_path: {
					description: 'Destination path for "rename" command.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
		private readonly _workspaceContextService: IWorkspaceContextService,
		private readonly _memoryCleanupService: IQuizMemoryCleanupService | undefined,
	) {
		super();
		if (this._memoryCleanupService) {
			this._memoryCleanupService.start();
		}
	}

	override async invoke(parameters: IQuizMemoryInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const path = parameters.command === 'rename' ? (parameters as IMemoryRenameParams).old_path ?? (parameters as IMemoryRenameParams).path : parameters.path;
			if (!path) {
				return quizToolResultError('Error: Missing required path parameter.');
			}
			const pathError = validatePath(path);
			if (pathError) {
				return quizToolResultError(pathError);
			}

			if (isRepoPath(path)) {
				return this._dispatchLocal(parameters, 'repo');
			}

			const scope: MemoryScope = isSessionPath(path) ? 'session' : 'user';
			return this._dispatchLocal(parameters, scope);
		} catch (err) {
			return quizToolResultError(`Failed to perform memory action: ${String(err)}`);
		}
	}

	private async _resolveUri(memoryPath: string, scope: MemoryScope): Promise<URI> {
		const pathError = validatePath(memoryPath);
		if (pathError) {
			throw new Error(pathError);
		}

		const segments = memoryPath.split('/').filter(s => s.length > 0);
		let relativeSegments: string[];

		if (scope === 'session') {
			const workspaceStorageUri = this._workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceStorageUri) {
				throw new Error('No workspace storage available. Session memory operations require an active workspace.');
			}
			relativeSegments = segments.slice(2);
			return relativeSegments.length > 0
				? URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR, ...relativeSegments)
				: URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR);
		}

		if (scope === 'repo') {
			const workspaceStorageUri = this._workspaceContextService.getWorkspace().folders[0]?.uri;
			if (!workspaceStorageUri) {
				throw new Error('No workspace storage available. Repository memory operations require an active workspace.');
			}
			relativeSegments = segments.slice(2);
			return relativeSegments.length > 0
				? URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR, 'repo', ...relativeSegments)
				: URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR, 'repo');
		}

		// User scope: /memories/foo.md → skip 'memories', keep rest
		relativeSegments = segments.slice(1);
		const workspaceStorageUri = this._workspaceContextService.getWorkspace().folders[0]?.uri;
		if (!workspaceStorageUri) {
			throw new Error('No workspace storage available. User memory operations require an active workspace.');
		}
		return relativeSegments.length > 0
			? URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR, ...relativeSegments)
			: URI.joinPath(workspaceStorageUri, '.vscode', MEMORY_BASE_DIR);
	}

	private async _dispatchLocal(params: IQuizMemoryInput, scope: MemoryScope): Promise<IQuizToolResult> {
		try {
			switch (params.command) {
				case 'view':
					return this._localView(params.path, params.view_range, scope);
				case 'create':
					return this._localCreate(params, scope);
				case 'str_replace':
					return this._localStrReplace(params, scope);
				case 'insert':
					return this._localInsert(params, scope);
				case 'delete':
					return this._localDelete(params.path, scope);
				case 'rename':
					return this._localRename(params, scope);
				default:
					return quizToolResultError(`Error: Unknown command '${(params as IQuizMemoryInput).command}'.`);
			}
		} catch (error) {
			return quizToolResultError(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async _localView(path: string, viewRange?: [number, number], scope: MemoryScope = 'user'): Promise<IQuizToolResult> {
		if (scope === 'user' && isMemoriesRoot(path)) {
			return this._localViewMergedRoot(path);
		}

		const uri = await this._resolveUri(path, scope);
		if (scope === 'session' && this._memoryCleanupService) {
			this._memoryCleanupService.markAccessed(uri);
		}

		let fileStat: { isDirectory: boolean; size: number };
		try {
			const stat = await this._fileService.stat(uri);
			fileStat = { isDirectory: stat.isDirectory ?? false, size: stat.size };
		} catch {
			if (isMemoriesRoot(path)) {
				return quizToolResultText('No memories found.');
			}
			return quizToolResultText(`No memories found in ${path}.`);
		}

		if (fileStat.isDirectory) {
			return this._listDirectory(path, uri);
		}

		const content = await this._fileService.readFile(uri);
		const text = content.value.toString();

		if (viewRange) {
			const lines = text.split('\n');
			const [start, end] = viewRange;
			if (start < 1 || start > lines.length) {
				return quizToolResultError(`Error: Invalid view_range: start line ${start} is out of range [1, ${lines.length}].`);
			}
			if (end < start || end > lines.length) {
				return quizToolResultError(`Error: Invalid view_range: end line ${end} is out of range [${start}, ${lines.length}].`);
			}
			const sliced = lines.slice(start - 1, end);
			const numbered = sliced.map((line, i) => `${formatLineNumber(start + i)}\t${line}`);
			return quizToolResultText(`Here's the content of ${path} (lines ${start}-${end}) with line numbers:\n${numbered.join('\n')}`);
		}

		return quizToolResultText(formatFileContent(path, text));
	}

	private async _localViewMergedRoot(path: string): Promise<IQuizToolResult> {
		const lines: string[] = [];
		let hasContent = false;

		// List user-scoped files
		try {
			const userUri = await this._resolveUri('/memories/', 'user');
			const userStat = await this._fileService.resolve(userUri);
			if (userStat.children) {
				for (const child of userStat.children) {
					if (child.name.startsWith('.')) { continue; }
					hasContent = true;
					if (child.isDirectory) {
						lines.push(`/memories/${child.name}/`);
					} else {
						lines.push(`/memories/${child.name}`);
					}
				}
			}
		} catch {
			// User storage may not exist yet
		}

		// List session directory
		lines.push('/memories/session/');

		// List repo directory
		lines.push('/memories/repo/');

		if (!hasContent) {
			return quizToolResultText('No memories found.');
		}

		return quizToolResultText(`Here are the files and directories in ${path}:\n${lines.join('\n')}`);
	}

	private async _listDirectory(path: string, uri: URI, maxDepth: number = 2, currentDepth: number = 0): Promise<IQuizToolResult> {
		if (currentDepth >= maxDepth) {
			return quizToolResultText('');
		}

		const stat = await this._fileService.resolve(uri);
		if (!stat.children) {
			return quizToolResultText('');
		}

		const lines: string[] = [];
		const sorted = [...stat.children].sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) { return -1; }
			if (!a.isDirectory && b.isDirectory) { return 1; }
			return (a.name ?? '').localeCompare(b.name ?? '');
		});

		for (const child of sorted) {
			if (child.name.startsWith('.')) { continue; }
			const childPath = path.endsWith('/') ? `${path}${child.name}` : `${path}/${child.name}`;
			const prefix = '  '.repeat(currentDepth);

			if (child.isDirectory) {
				lines.push(`${prefix}${child.name}/`);
				const subResult = await this._listDirectory(childPath, child.resource, maxDepth, currentDepth + 1);
				if (subResult.text) {
					lines.push(subResult.text);
				}
			} else {
				try {
					const childStat = await this._fileService.stat(child.resource);
					lines.push(`${prefix}${childStat.size}\t${childPath}`);
				} catch {
					lines.push(`${prefix}${child.name}`);
				}
			}
		}

		if (currentDepth === 0) {
			return quizToolResultText(`Here are the files and directories up to 2 levels deep in ${path}, excluding hidden items:\n${lines.join('\n')}`);
		}
		return quizToolResultText(lines.join('\n'));
	}

	private async _localCreate(params: IMemoryCreateParams, scope: MemoryScope): Promise<IQuizToolResult> {
		const uri = await this._resolveUri(params.path, scope);

		// Check if file exists
		try {
			await this._fileService.stat(uri);
			return quizToolResultError(`Error: File ${params.path} already exists`);
		} catch {
			// File doesn't exist — good
		}

		// Ensure parent directory exists
		const parentUri = URI.joinPath(uri, '..');
		try {
			await this._fileService.createFolder(parentUri);
		} catch {
			// Parent may already exist
		}

		await this._fileService.writeFile(uri, VSBuffer.fromString(params.file_text));
		if (scope === 'session' && this._memoryCleanupService) {
			this._memoryCleanupService.markAccessed(uri);
		}
		return quizToolResultText(`File created successfully at: ${params.path}`);
	}

	private async _localStrReplace(params: IMemoryStrReplaceParams, scope: MemoryScope): Promise<IQuizToolResult> {
		const uri = await this._resolveUri(params.path, scope);
		if (scope === 'session' && this._memoryCleanupService) {
			this._memoryCleanupService.markAccessed(uri);
		}

		let content: string;
		try {
			const buffer = await this._fileService.readFile(uri);
			content = buffer.value.toString();
		} catch {
			return quizToolResultText(`The path ${params.path} does not exist. Please provide a valid path.`);
		}

		const occurrences: number[] = [];
		let searchStart = 0;
		while (true) {
			const idx = content.indexOf(params.old_str, searchStart);
			if (idx === -1) { break; }
			const lineNumber = content.substring(0, idx).split('\n').length;
			occurrences.push(lineNumber);
			searchStart = idx + 1;
		}

		if (occurrences.length === 0) {
			return quizToolResultError(`No replacement was performed, old_str \`${params.old_str}\` did not appear verbatim in ${params.path}.`);
		}

		if (occurrences.length > 1) {
			return quizToolResultError(`No replacement was performed. Multiple occurrences of old_str \`${params.old_str}\` in lines: ${occurrences.join(', ')}. Please ensure it is unique.`);
		}

		const newContent = content.replace(params.old_str, params.new_str);
		await this._fileService.writeFile(uri, VSBuffer.fromString(newContent));
		return quizToolResultText(makeSnippet(newContent, occurrences[0], params.path));
	}

	private async _localInsert(params: IMemoryInsertParams, scope: MemoryScope): Promise<IQuizToolResult> {
		const uri = await this._resolveUri(params.path, scope);
		if (scope === 'session' && this._memoryCleanupService) {
			this._memoryCleanupService.markAccessed(uri);
		}

		const insertText = params.insert_text ?? params.new_str;
		if (!insertText) {
			return quizToolResultError('Error: Missing required insert_text parameter for insert.');
		}

		let content: string;
		try {
			const buffer = await this._fileService.readFile(uri);
			content = buffer.value.toString();
		} catch {
			return quizToolResultError(`Error: The path ${params.path} does not exist`);
		}

		const lines = content.split('\n');
		const nLines = lines.length;

		if (params.insert_line < 0 || params.insert_line > nLines) {
			return quizToolResultError(`Error: Invalid \`insert_line\` parameter: ${params.insert_line}. It should be within the range of lines of the file: [0, ${nLines}].`);
		}

		const newLines = insertText.split('\n');
		lines.splice(params.insert_line, 0, ...newLines);

		const newContent = lines.join('\n');
		await this._fileService.writeFile(uri, VSBuffer.fromString(newContent));
		return quizToolResultText(makeSnippet(newContent, params.insert_line + 1, params.path));
	}

	private async _localDelete(path: string, scope: MemoryScope): Promise<IQuizToolResult> {
		const uri = await this._resolveUri(path, scope);

		try {
			await this._fileService.stat(uri);
		} catch {
			return quizToolResultError(`Error: The path ${path} does not exist`);
		}

		await this._fileService.del(uri, { recursive: true });
		return quizToolResultText(`Successfully deleted ${path}`);
	}

	private async _localRename(params: IMemoryRenameParams, scope: MemoryScope): Promise<IQuizToolResult> {
		const oldPath = params.old_path ?? params.path;
		if (!oldPath) {
			return quizToolResultError('Error: Missing required old_path parameter for rename.');
		}

		const newPathError = validatePath(params.new_path);
		if (newPathError) {
			return quizToolResultError(newPathError);
		}

		// Prevent renaming across different scopes
		const newScope: MemoryScope = isRepoPath(params.new_path) ? 'repo' : isSessionPath(params.new_path) ? 'session' : 'user';
		if (scope !== newScope) {
			return quizToolResultError('Error: Cannot rename across different memory scopes.');
		}

		const srcUri = await this._resolveUri(oldPath, scope);
		const destUri = await this._resolveUri(params.new_path, scope);

		try {
			await this._fileService.stat(srcUri);
		} catch {
			return quizToolResultError(`Error: The path ${oldPath} does not exist`);
		}

		try {
			await this._fileService.stat(destUri);
			return quizToolResultError(`Error: The destination ${params.new_path} already exists`);
		} catch {
			// Destination doesn't exist — good
		}

		// Ensure parent directory of destination exists
		const destParent = URI.joinPath(destUri, '..');
		try {
			await this._fileService.createFolder(destParent);
		} catch {
			// Parent may already exist
		}

		// Read source, write destination, delete source (rename via copy+delete)
		const content = await this._fileService.readFile(srcUri);
		await this._fileService.writeFile(destUri, content.value);
		await this._fileService.del(srcUri, { recursive: true });

		if (scope === 'session' && this._memoryCleanupService) {
			this._memoryCleanupService.markAccessed(destUri);
		}
		return quizToolResultText(`Successfully renamed ${oldPath} to ${params.new_path}`);
	}
}

// #endregion

// #region QuizCodebaseToolImpl (browser-layer, aligned with Copilot's CodebaseTool / semantic_search)

/**
 * Maximum results for codebase search.
 * Aligned with Copilot's CodebaseTool maxResults = 32.
 */
const CODEBASE_MAX_RESULTS = 32;

export interface IQuizCodebaseInput {
	query: string;
	/** Internal parameter: scope search to specific directories. Aligned with Copilot's scopedDirectories. */
	scopedDirectories?: string[];
}

export class QuizCodebaseToolImpl extends QuizBuiltinTool<IQuizCodebaseInput> {

	readonly toolName = QuizToolName.Codebase;

	readonly definition = {
		name: QuizToolName.Codebase,
		description: 'Semantic search across the codebase. Finds relevant code snippets based on natural language queries. Returns matching file paths, line numbers, and code snippets. Use this tool when you need to find code by concept rather than exact text match.',
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

	constructor(
		private readonly _searchService: ISearchService,
		private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	override async invoke(parameters: IQuizCodebaseInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const query = parameters.query.replace(/^\s*#codebase\s+/, '').trim();
			if (!query) {
				return quizToolResultError('Invalid input: query is required');
			}

			// Build folder queries — aligned with Copilot's scopedDirectories support
			const folderQueries = parameters.scopedDirectories?.length
				? parameters.scopedDirectories.map(dir => ({ folder: URI.file(dir) }))
				: this._workspaceContextService.getWorkspace().folders.map(f => ({ folder: f.uri }));

			// Try AI/semantic search first — aligned with Copilot's workspaceChunkSearchService.isAvailable()
			let result: import('../../../../services/search/common/search.js').ISearchComplete | undefined;
			let usedSemanticSearch = false;

			try {
				const aiName = await this._searchService.getAIName();
				if (aiName) {
					// AI text search available — use semantic search
					const aiQuery: import('../../../../services/search/common/search.js').IAITextQuery = {
						type: QueryType.aiText,
						contentPattern: query,
						folderQueries,
						maxResults: CODEBASE_MAX_RESULTS,
					};

					result = await this._searchService.aiTextSearch(aiQuery, token);
					usedSemanticSearch = true;
				}
			} catch {
				// AI search not available or failed — fall back to text search
			}

			// Fall back to text search — aligned with Copilot's fallback behavior
			if (!result) {
				const textQuery: import('../../../../services/search/common/search.js').ITextQuery = {
					type: QueryType.Text,
					contentPattern: {
						pattern: query,
						isRegExp: false,
						isCaseSensitive: false,
						isWordMatch: false,
					},
					folderQueries,
					maxResults: CODEBASE_MAX_RESULTS,
				};

				result = await this._searchService.textSearch(textQuery, token);
			}

			if (!result.results.length) {
				const searchTarget = this._getDisplaySearchTarget(parameters);
				return quizToolResultText(`Searched ${searchTarget} for "${query}", no results`);
			}

			// Format results — aligned with Copilot's WorkspaceContext rendering
			const lines: string[] = [];
			const searchTarget = this._getDisplaySearchTarget(parameters);
			const resultCount = result.results.length;
			lines.push(`Searched ${searchTarget} for "${query}", ${resultCount} result${resultCount === 1 ? '' : 's'}${usedSemanticSearch ? ' (semantic)' : ' (text)'}:`);
			lines.push('');

			for (const item of result.results.slice(0, CODEBASE_MAX_RESULTS)) {
				const fileMatch: IFileMatch = item;
				if (fileMatch.results) {
					const filePath = fileMatch.resource.fsPath;
					for (const r of fileMatch.results) {
						if (resultIsMatch(r)) {
							const textMatch: ITextSearchMatch = r;
							const rangeLocations = textMatch.rangeLocations;
							const startLine = rangeLocations?.[0]?.source?.startLineNumber
								?? '';
							const endLine = rangeLocations?.[0]?.source?.endLineNumber
								?? '';
							const lineRange = startLine === endLine || !endLine
								? `${startLine}`
								: `${startLine}-${endLine}`;
							lines.push(`${filePath}:${lineRange}: ${textMatch.previewText.trim()}`);
						}
					}
				}
			}

			if (result.limitHit) {
				lines.push('');
				lines.push('Results may be incomplete. Try a more specific query.');
			}

			return quizToolResultText(lines.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to search codebase: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizCodebaseInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const searchTarget = this._getDisplaySearchTarget(parameters);
		return {
			invocationMessage: `Searching ${searchTarget} for "${parameters.query}"`,
		};
	}

	/** Aligned with Copilot's CodebaseTool.getDisplaySearchTarget */
	private _getDisplaySearchTarget(input: IQuizCodebaseInput): string {
		if (input.scopedDirectories && input.scopedDirectories.length === 1) {
			const basename = input.scopedDirectories[0].split(/[/\\]/).pop() ?? input.scopedDirectories[0];
			return basename;
		}
		if (input.scopedDirectories && input.scopedDirectories.length > 1) {
			return `${input.scopedDirectories.length} directories`;
		}
		return 'codebase';
	}
}

// #endregion

// #region QuizReadProjectStructureToolImpl (browser-layer, aligned with Copilot's ReadProjectStructureTool)

export interface IQuizReadProjectStructureInput {
	path?: string;
}

export class QuizReadProjectStructureToolImpl extends QuizBuiltinTool<IQuizReadProjectStructureInput> {

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

	constructor(
		private readonly _fileService: IFileService,
		private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	override async invoke(parameters: IQuizReadProjectStructureInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const rootUri = parameters.path
				? URI.file(parameters.path)
				: this._workspaceContextService.getWorkspace().folders[0]?.uri;

			if (!rootUri) {
				return quizToolResultError('No workspace folder available');
			}

			const result = await this._buildTree(rootUri, 0, 3, token);
			return quizToolResultText(result);
		} catch (err) {
			return quizToolResultError(`Failed to read project structure: ${String(err)}`);
		}
	}

	private async _buildTree(uri: URI, depth: number, maxDepth: number, token: CancellationToken): Promise<string> {
		if (token.isCancellationRequested || depth > maxDepth) {
			return '';
		}

		try {
			const stat = await this._fileService.resolve(uri, { resolveSingleChildDescendants: depth < maxDepth });
			if (!stat.children) {
				return '';
			}

			const indent = '  '.repeat(depth);
			const lines: string[] = [];

			// Sort: directories first, then files
			const sorted = [...stat.children].sort((a, b) => {
				if (a.isDirectory && !b.isDirectory) { return -1; }
				if (!a.isDirectory && b.isDirectory) { return 1; }
				return (a.name ?? '').localeCompare(b.name ?? '');
			});

			for (const child of sorted) {
				const prefix = child.isDirectory ? 'DIR ' : 'FILE ';
				lines.push(`${indent}${prefix}${child.name}`);

				if (child.isDirectory && depth < maxDepth) {
					const subTree = await this._buildTree(child.resource, depth + 1, maxDepth, token);
					if (subTree) {
						lines.push(subTree);
					}
				}
			}

			return lines.join('\n');
		} catch {
			return '';
		}
	}
}

// #endregion

// #region QuizFetchWebPageToolImpl (browser-layer, aligned with Copilot's FetchWebPageTool)

export interface IQuizFetchWebPageInput {
	url: string;
}

export class QuizFetchWebPageToolImpl extends QuizBuiltinTool<IQuizFetchWebPageInput> {

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

	constructor(
		private readonly _requestService: IRequestService,
	) {
		super();
	}

	override async invoke(parameters: IQuizFetchWebPageInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const response = await this._requestService.request({ url: parameters.url, callSite: 'QuizFetchWebPage' }, token);
			const buffer = await streamToBuffer(response.stream);
			const text = buffer.toString();

			// Strip HTML tags for a plain text representation
			const plainText = text
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
				.replace(/<[^>]+>/g, '')
				.replace(/&nbsp;/g, ' ')
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, String.fromCharCode(39))
				.replace(/\s+/g, ' ')
				.trim();

			// Truncate at 5000 chars
			const truncated = plainText.length > 5000;
			const content = truncated ? plainText.substring(0, 5000) + '\n[Content truncated at 5000 characters]' : plainText;

			return quizToolResultText(content);
		} catch (err) {
			return quizToolResultError(`Failed to fetch web page: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizFetchWebPageInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Fetch web page?',
				message: `Fetch content from \`${parameters.url}\`?`,
			},
			invocationMessage: `Fetching ${parameters.url}`,
		};
	}
}

// #endregion

// #region QuizFindTestFilesToolImpl (browser-layer, aligned with Copilot's FindTestFilesTool)

export interface IQuizFindTestFilesInput {
	path?: string;
}

export class QuizFindTestFilesToolImpl extends QuizBuiltinTool<IQuizFindTestFilesInput> {

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

	constructor(
		private readonly _searchService: ISearchService,
		private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	override async invoke(parameters: IQuizFindTestFilesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const folderQueries = parameters.path
				? [{ folder: URI.file(parameters.path) }]
				: this._workspaceContextService.getWorkspace().folders.map(f => ({ folder: f.uri }));

			// Search for common test file patterns
			const testPatterns = [
				'**/*.test.ts', '**/*.test.js', '**/*.test.tsx', '**/*.test.jsx',
				'**/*.spec.ts', '**/*.spec.js', '**/*.spec.tsx', '**/*.spec.jsx',
				'**/*Test.ts', '**/*Test.java', '**/*_test.go', '**/*_test.py',
				'**/test/**', '**/tests/**', '**/__tests__/**',
			];

			const query: IFileQuery = {
				type: QueryType.File,
				folderQueries,
				filePattern: `{${testPatterns.join(',')}}`,
				maxResults: 50,
			};

			const result = await this._searchService.fileSearch(query, token);

			if (!result.results.length) {
				return quizToolResultText('No test files found.');
			}

			const paths = result.results.map(r => r.resource.fsPath);
			return quizToolResultText(paths.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to find test files: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizInstallExtensionToolImpl (browser-layer, aligned with Copilot's InstallExtensionTool)

export interface IQuizInstallExtensionInput {
	extensionId: string;
}

export class QuizInstallExtensionToolImpl extends QuizBuiltinTool<IQuizInstallExtensionInput> {

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

	constructor(
		private readonly _extensionManagementService: IExtensionManagementService,
		private readonly _extensionGalleryService: IExtensionGalleryService,
	) {
		super();
	}

	override async invoke(parameters: IQuizInstallExtensionInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const [publisher, name] = parameters.extensionId.split('.');
			if (!publisher || !name) {
				return quizToolResultError(`Invalid extension ID format: "${parameters.extensionId}". Expected "publisher.extension-name".`);
			}

			const extensionInfo = { id: parameters.extensionId, preRelease: false };
			const extensions = await this._extensionGalleryService.getExtensions([extensionInfo], token);
			if (extensions.length === 0) {
				return quizToolResultError(`Extension "${parameters.extensionId}" not found in marketplace.`);
			}

			const result = await this._extensionManagementService.installFromGallery(extensions[0], { context: { from: 'quiz' } });

			return quizToolResultText(`Extension installed: ${result.identifier.id} (v${result.manifest.version})`);
		} catch (err) {
			return quizToolResultError(`Failed to install extension: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizInstallExtensionInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Install extension?',
				message: `Install extension \`${parameters.extensionId}\` from the marketplace?`,
			},
			invocationMessage: `Installing extension ${parameters.extensionId}`,
		};
	}
}

// #endregion

/**
 * Register all browser-layer workspace tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 * Aligned with Copilot's tool registration pattern via ToolRegistry.registerTool.
 */
export function registerQuizBrowserWorkspaceTools(
	fileService: IFileService,
	markerService: IMarkerService,
	searchService: ISearchService,
	workspaceContextService: IWorkspaceContextService,
	scmService: ISCMService,
	requestService: IRequestService,
	extensionManagementService: IExtensionManagementService,
	extensionGalleryService: IExtensionGalleryService,
	commandService: ICommandService,
	memoryCleanupService: IQuizMemoryCleanupService | undefined,
): void {
	QuizBuiltinToolRegistry.register(new QuizGetErrorsToolImpl(markerService));
	QuizBuiltinToolRegistry.register(new QuizSearchWorkspaceSymbolsToolImpl(commandService));
	QuizBuiltinToolRegistry.register(new QuizGetScmChangesToolImpl(scmService));
	QuizBuiltinToolRegistry.register(new QuizViewImageToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizMemoryToolImpl(fileService, workspaceContextService, memoryCleanupService));
	QuizBuiltinToolRegistry.register(new QuizCodebaseToolImpl(searchService, workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizReadProjectStructureToolImpl(fileService, workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizFetchWebPageToolImpl(requestService));
	QuizBuiltinToolRegistry.register(new QuizFindTestFilesToolImpl(searchService, workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizInstallExtensionToolImpl(extensionManagementService, extensionGalleryService));
}
