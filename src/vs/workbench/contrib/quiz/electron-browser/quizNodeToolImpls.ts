/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Layer: electron-browser — Node-capable tool implementations that override browser-layer defaults.
// These use IFileService (which delegates to the disk file system provider
// in Electron, offering better performance than the browser-layer remote providers).
// Moved from node/ to eliminate the cross-layer import from electron-browser → node.
// Aligned with Copilot's tools/node/ pattern where file operations are
// registered in the electron-browser contribution to override browser-layer defaults.

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IQuizToolResult, IQuizToolDefinition } from '../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../common/tools/quizToolsService.js';
import { QuizToolName } from '../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../common/tools/quizBuiltinTools.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { MAX_OUTPUT_LINES, MAX_LINE_LENGTH, MAX_HEXDUMP_BYTES, knownBinaryExtensions, isBinaryContent, formatHexdump } from '../common/tools/quizBinaryUtils.js';

// #region QuizNodeReadFileTool (electron-browser, aligned with Copilot's readFileTool.tsx)

export interface IQuizNodeReadFileInput {
	filePath: string;
	offset?: number;
	limit?: number;
}

export class QuizNodeReadFileTool extends QuizBuiltinTool<IQuizNodeReadFileInput> {

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

	override async invoke(parameters: IQuizNodeReadFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const content = await this._fileService.readFile(uri);

			// Binary file detection
			const extDot = uri.path.lastIndexOf('.');
			const ext = extDot >= 0 ? uri.path.substring(extDot).toLowerCase() : '';
			const data = content.value.buffer;

			if (isBinaryContent(data) || knownBinaryExtensions.has(ext)) {
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

			const text = content.value.toString();

			if (text.length === 0) {
				return quizToolResultText(`The file \`${parameters.filePath}\` exists, but is empty.`);
			}
			if (text.trim().length === 0) {
				return quizToolResultText(`The file \`${parameters.filePath}\` exists, but contains only whitespace.`);
			}

			const lines = text.split('\n');
			const totalLines = lines.length;

			const startLine = Math.max(1, parameters.offset ?? 1);
			if (startLine > totalLines) {
				return quizToolResultError(`Invalid offset ${startLine}: file only has ${totalLines} line${totalLines === 1 ? '' : 's'}. Line numbers are 1-indexed.`);
			}

			const limit = Math.min(parameters.limit ?? MAX_OUTPUT_LINES, MAX_OUTPUT_LINES);
			const endLine = Math.min(startLine + limit, totalLines + 1);
			const selectedLines = lines.slice(startLine - 1, endLine - 1);

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

// #region QuizNodeWriteFileTool (electron-browser, direct file write capability)

export interface IQuizNodeWriteFileInput {
	filePath: string;
	content: string;
	createDirectories?: boolean;
}

export class QuizNodeWriteFileTool extends QuizBuiltinTool<IQuizNodeWriteFileInput> {

	readonly toolName = QuizToolName.CreateFile;

	readonly definition = {
		name: QuizToolName.CreateFile,
		description: 'Create a new file with the specified content. Creates parent directories if needed.',
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
				createDirectories: {
					description: 'Whether to create parent directories if they do not exist. Default: true.',
					type: 'boolean',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async invoke(parameters: IQuizNodeWriteFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const createDirs = parameters.createDirectories ?? true;

			if (createDirs) {
				const dirUri = URI.joinPath(uri, '..');
				try {
					await this._fileService.createFolder(dirUri);
				} catch {
					// Directory may already exist
				}
			}

			const exists = await this._fileService.exists(uri);
			await this._fileService.writeFile(uri, VSBuffer.fromString(parameters.content));

			this._logService.trace(`QuizNodeWriteFileTool: ${exists ? 'overwrote' : 'created'} ${parameters.filePath}`);
			return quizToolResultText(exists
				? `File overwritten: ${parameters.filePath}`
				: `File created: ${parameters.filePath}`);
		} catch (err) {
			return quizToolResultError(`Failed to write file: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizNodeWriteFileInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
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

/**
 * Register all node-capable tool implementations, overriding the
 * common-layer stubs and browser-layer implementations where
 * Electron's disk file system provider offers better functionality.
 */
export function registerQuizNodeTools(
	fileService: IFileService,
	logService: ILogService,
): void {
	QuizBuiltinToolRegistry.register(new QuizNodeReadFileTool(fileService));
	QuizBuiltinToolRegistry.register(new QuizNodeWriteFileTool(fileService, logService));
}
