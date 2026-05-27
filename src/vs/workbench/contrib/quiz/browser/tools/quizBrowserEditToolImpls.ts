/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer edit tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's tools/node/editFileTool.tsx, replaceStringTool.tsx, etc.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

// #region QuizInsertEditToolImpl (browser-layer, aligned with Copilot's InsertEditTool)

export interface IQuizInsertEditInput {
	filePath: string;
	code: string;
}

export class QuizInsertEditToolImpl extends QuizBuiltinTool<IQuizInsertEditInput> {

	readonly toolName = QuizToolName.EditFile;

	readonly definition = {
		name: QuizToolName.EditFile,
		description: 'Insert code into a file. The tool will insert the provided code at the appropriate location based on the surrounding context.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'code'],
			properties: {
				filePath: {
					description: 'The absolute path of the file to edit.',
					type: 'string',
				},
				code: {
					description: 'The code to insert into the file.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _textFileService: ITextFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizInsertEditInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const textFile = this._textFileService.files.get(uri);
			if (!textFile || !textFile.textEditorModel) {
				return quizToolResultError(`File not found or not open: ${parameters.filePath}`);
			}

			const model = textFile.textEditorModel;
			const lastLine = model.getLineCount();
			const lastCol = model.getLineMaxColumn(lastLine);

			// Append code at end of file (simplified — Copilot does streaming edit with healing)
			model.applyEdits([{
				range: { startLineNumber: lastLine, startColumn: lastCol, endLineNumber: lastLine, endColumn: lastCol },
				text: '\n' + parameters.code,
			}]);

			await this._textFileService.save(uri);
			return quizToolResultText(`Edit applied to ${parameters.filePath}`);
		} catch (err) {
			return quizToolResultError(`Failed to apply edit: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}
}

// #endregion

// #region QuizReplaceStringToolImpl (browser-layer, aligned with Copilot's ReplaceStringTool)

export interface IQuizReplaceStringInput {
	filePath: string;
	oldText: string;
	newText: string;
}

export class QuizReplaceStringToolImpl extends QuizBuiltinTool<IQuizReplaceStringInput> {

	readonly toolName = QuizToolName.ReplaceString;

	readonly definition = {
		name: QuizToolName.ReplaceString,
		description: 'Replace a string in a file. The tool will find and replace the exact old text with the new text.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'oldText', 'newText'],
			properties: {
				filePath: {
					description: 'The absolute path of the file to edit.',
					type: 'string',
				},
				oldText: {
					description: 'The text to find and replace. Must be an exact match.',
					type: 'string',
				},
				newText: {
					description: 'The replacement text.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _textFileService: ITextFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizReplaceStringInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const textFile = this._textFileService.files.get(uri);
			if (!textFile || !textFile.textEditorModel) {
				return quizToolResultError(`File not found or not open: ${parameters.filePath}`);
			}

			const model = textFile.textEditorModel;
			const content = model.getValue();
			const oldIndex = content.indexOf(parameters.oldText);

			if (oldIndex === -1) {
				return quizToolResultError(`Text not found in ${parameters.filePath}: "${parameters.oldText.substring(0, 80)}..."`);
			}

			// Find the line/column position from offset
			const beforeText = content.substring(0, oldIndex);
			const lines = beforeText.split('\n');
			const startLine = lines.length;
			const startCol = lines[lines.length - 1].length + 1;

			const afterOld = content.substring(0, oldIndex + parameters.oldText.length);
			const afterLines = afterOld.split('\n');
			const endLine = afterLines.length;
			const endCol = afterLines[afterLines.length - 1].length + 1;

			model.applyEdits([{
				range: { startLineNumber: startLine, startColumn: startCol, endLineNumber: endLine, endColumn: endCol },
				text: parameters.newText,
			}]);

			await this._textFileService.save(uri);
			return quizToolResultText(`Replace applied in ${parameters.filePath}`);
		} catch (err) {
			return quizToolResultError(`Failed to apply replace: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}
}

// #endregion

// #region QuizMultiReplaceStringToolImpl (browser-layer, aligned with Copilot's MultiReplaceStringTool)

export interface IQuizMultiReplaceStringInput {
	filePath: string;
	replacements: readonly { oldText: string; newText: string }[];
}

export class QuizMultiReplaceStringToolImpl extends QuizBuiltinTool<IQuizMultiReplaceStringInput> {

	readonly toolName = QuizToolName.MultiReplaceString;

	readonly definition = {
		name: QuizToolName.MultiReplaceString,
		description: 'Apply multiple string replacements in a single file. Each replacement finds and replaces the exact old text with the new text.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'replacements'],
			properties: {
				filePath: {
					description: 'The absolute path of the file to edit.',
					type: 'string',
				},
				replacements: {
					description: 'Array of replacements to apply in order.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							oldText: { description: 'The text to find and replace.', type: 'string' },
							newText: { description: 'The replacement text.', type: 'string' },
						},
						required: ['oldText', 'newText'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _textFileService: ITextFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizMultiReplaceStringInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const textFile = this._textFileService.files.get(uri);
			if (!textFile || !textFile.textEditorModel) {
				return quizToolResultError(`File not found or not open: ${parameters.filePath}`);
			}

			const model = textFile.textEditorModel;
			let content = model.getValue();
			let applied = 0;
			const notFound: string[] = [];

			for (const replacement of parameters.replacements) {
				const idx = content.indexOf(replacement.oldText);
				if (idx === -1) {
					notFound.push(replacement.oldText.substring(0, 50));
					continue;
				}
				content = content.substring(0, idx) + replacement.newText + content.substring(idx + replacement.oldText.length);
				applied++;
			}

			// Apply the full updated content
			model.setValue(content);
			await this._textFileService.save(uri);

			const result = `Multi-replace applied in ${parameters.filePath}: ${applied} of ${parameters.replacements.length} replacements succeeded`;
			if (notFound.length > 0) {
				return quizToolResultText(result + `\nNot found: ${notFound.join('; ')}`);
			}
			return quizToolResultText(result);
		} catch (err) {
			return quizToolResultError(`Failed to apply multi-replace: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}
}

// #endregion

// #region QuizApplyPatchToolImpl (browser-layer, aligned with Copilot's ApplyPatchTool)

export interface IQuizApplyPatchInput {
	patch: string;
}

export class QuizApplyPatchToolImpl extends QuizBuiltinTool<IQuizApplyPatchInput> {

	readonly toolName = QuizToolName.ApplyPatch;

	readonly definition = {
		name: QuizToolName.ApplyPatch,
		description: 'Apply a unified diff patch to the workspace. The patch should be in standard unified diff format.',
		inputSchema: {
			type: 'object',
			required: ['patch'],
			properties: {
				patch: {
					description: 'The unified diff patch to apply.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _textFileService: ITextFileService,
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizApplyPatchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Parse unified diff and apply changes
			// Simplified implementation — Copilot has a full 42KB patch parser with healing
			const filesChanged = this._parseUnifiedDiffFiles(parameters.patch);
			const results: string[] = [];

			for (const fileChange of filesChanged) {
				const uri = URI.file(fileChange.filePath);
				const exists = await this._fileService.exists(uri);

				if (!exists && fileChange.isNewFile) {
					await this._fileService.writeFile(uri, VSBuffer.fromString(fileChange.newContent));
					results.push(`Created: ${fileChange.filePath}`);
				} else if (exists) {
					const textFile = this._textFileService.files.get(uri);
					if (textFile?.textEditorModel) {
						textFile.textEditorModel.setValue(fileChange.newContent);
						await this._textFileService.save(uri);
						results.push(`Modified: ${fileChange.filePath}`);
					} else {
						await this._fileService.writeFile(uri, VSBuffer.fromString(fileChange.newContent));
						results.push(`Written: ${fileChange.filePath}`);
					}
				}
			}

			return quizToolResultText(results.join('\n') || 'Patch applied (no files changed)');
		} catch (err) {
			return quizToolResultError(`Failed to apply patch: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}

	/**
	 * Minimal unified diff parser. Extracts file paths and final content.
	 * Copilot has a much more sophisticated parser with healing — this is a simplified version.
	 */
	private _parseUnifiedDiffFiles(patch: string): { filePath: string; isNewFile: boolean; newContent: string }[] {
		const results: { filePath: string; isNewFile: boolean; newContent: string }[] = [];
		const lines = patch.split('\n');
		let currentFile: string | undefined;
		let currentContent: string[] = [];
		let isNewFile = false;

		for (const line of lines) {
			const fileMatch = line.match(/^--- (?:a\/)?(.+)$/);
			if (fileMatch) {
				if (currentFile && currentContent.length > 0) {
					results.push({ filePath: currentFile, isNewFile, newContent: currentContent.join('\n') });
				}
				currentContent = [];
				isNewFile = false;
				continue;
			}

			const newFileMatch = line.match(/^\+\+\+ (?:b\/)?(.+)$/);
			if (newFileMatch) {
				currentFile = newFileMatch[1];
				if (currentFile === '/dev/null') {
					isNewFile = true;
				}
				continue;
			}

			// Content lines
			if (line.startsWith('+') && !line.startsWith('+++')) {
				currentContent.push(line.substring(1));
			} else if (line.startsWith(' ')) {
				currentContent.push(line.substring(1));
			}
			// Skip '-' lines (removed), '@@' lines (hunk headers), and other metadata
		}

		if (currentFile && currentContent.length > 0) {
			results.push({ filePath: currentFile, isNewFile, newContent: currentContent.join('\n') });
		}

		return results;
	}
}

// #endregion

/**
 * Register all browser-layer edit tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserEditTools(
	textFileService: ITextFileService,
	fileService: IFileService,
): void {
	QuizBuiltinToolRegistry.register(new QuizInsertEditToolImpl(textFileService));
	QuizBuiltinToolRegistry.register(new QuizReplaceStringToolImpl(textFileService));
	QuizBuiltinToolRegistry.register(new QuizMultiReplaceStringToolImpl(textFileService));
	QuizBuiltinToolRegistry.register(new QuizApplyPatchToolImpl(textFileService, fileService));
}
