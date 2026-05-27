/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer edit tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's tools/node/editFileTool.tsx, replaceStringTool.tsx, etc.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { autorun } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { URI, UriComponents } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ICodeMapperService } from '../../../chat/common/editing/chatCodeMapperService.js';
import { TextEdit } from '../../../../../editor/common/languages.js';
import { ICellEditOperation, CellUri } from '../../../notebook/common/notebookCommon.js';
import { IChatService } from '../../../chat/common/chatService/chatService.js';
import { ChatModel } from '../../../chat/common/model/chatModel.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

// #region Fuzzy matching helpers (aligned with Copilot's editFileHealing.tsx)

/**
 * Normalize whitespace for fuzzy matching.
 * Collapses consecutive whitespace into single spaces and trims.
 */
function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * Try to find oldText in content with fuzzy matching.
 * Returns the actual text found and its offset, or undefined.
 * Aligned with Copilot's healing/fuzzy matching strategy.
 */
function fuzzyFindText(content: string, oldText: string): { actualText: string; offset: number } | undefined {
	// 1. Exact match
	const exactIdx = content.indexOf(oldText);
	if (exactIdx !== -1) {
		return { actualText: oldText, offset: exactIdx };
	}

	// 2. Whitespace-normalized match (aligned with Copilot's whitespace healing)
	const normalizedContent = normalizeWhitespace(content);
	const normalizedOld = normalizeWhitespace(oldText);
	const normalizedIdx = normalizedContent.indexOf(normalizedOld);
	if (normalizedIdx !== -1) {
		// Map back to original content position
		// Walk through original content tracking normalized position
		let normPos = 0;
		let origPos = 0;
		let inWhitespace = false;
		while (origPos < content.length && normPos < normalizedIdx) {
			const ch = content[origPos];
			if (/\s/.test(ch)) {
				if (!inWhitespace) {
					normPos++; // space in normalized
					inWhitespace = true;
				}
			} else {
				normPos++;
				inWhitespace = false;
			}
			origPos++;
		}
		// Skip leading whitespace at match position
		while (origPos < content.length && /\s/.test(content[origPos]) && normPos < normalizedIdx) {
			origPos++;
			normPos++;
		}

		// Find the end of the match in original content
		const startOrig = origPos;
		const endNormPos = normalizedIdx + normalizedOld.length;
		let endOrigPos = origPos;
		normPos = normalizedIdx;
		inWhitespace = false;
		while (endOrigPos < content.length && normPos < endNormPos) {
			const ch = content[endOrigPos];
			if (/\s/.test(ch)) {
				if (!inWhitespace) {
					normPos++;
					inWhitespace = true;
				}
			} else {
				normPos++;
				inWhitespace = false;
			}
			endOrigPos++;
		}
		// Include trailing whitespace
		while (endOrigPos < content.length && /\s/.test(content[endOrigPos])) {
			endOrigPos++;
		}

		const actualText = content.substring(startOrig, endOrigPos);
		return { actualText, offset: startOrig };
	}

	return undefined;
}

/**
 * Convert a character offset in content to line/column position.
 */
function offsetToPosition(content: string, offset: number): { line: number; column: number } {
	const before = content.substring(0, offset);
	const lines = before.split('\n');
	return {
		line: lines.length,
		column: lines[lines.length - 1].length + 1,
	};
}

// #endregion

// #region QuizInsertEditToolImpl (browser-layer, aligned with Copilot's EditTool)

export interface IQuizInsertEditInput {
	uri: UriComponents;
	explanation: string;
	code: string;
}

export class QuizInsertEditToolImpl extends QuizBuiltinTool<IQuizInsertEditInput> {

	readonly toolName = QuizToolName.EditFile;

	readonly definition = {
		name: QuizToolName.EditFile,
		description: 'Edit a file by applying code changes. The tool will use the code mapper service to apply edits to the specified file, streaming changes through the chat editing session.',
		inputSchema: {
			type: 'object',
			required: ['uri', 'explanation', 'code'],
			properties: {
				uri: {
					description: 'The URI of the file to edit. Can be a file URI or notebook cell URI.',
					type: 'object',
				},
				explanation: {
					description: 'A short explanation of what the edit does. This will be shown alongside the code block.',
					type: 'string',
				},
				code: {
					description: 'The code to apply to the file. The code mapper will determine how to integrate this with the existing file content.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _chatService: IChatService,
		private readonly _codeMapperService: ICodeMapperService,
		private readonly _notebookService: INotebookService,
	) {
		super();
	}

	override async invoke(parameters: IQuizInsertEditInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		const chatSessionResource = context.sessionResource;
		if (!chatSessionResource) {
			return quizToolResultError('No session resource available');
		}

		try {
			// Revive URI and resolve notebook cell URIs (aligned with Copilot's EditTool)
			const fileUri = URI.revive(parameters.uri);
			const uri = CellUri.parse(fileUri)?.notebook || fileUri;

			const model = this._chatService.getSession(chatSessionResource) as ChatModel | undefined;
			if (!model) {
				return quizToolResultError('Chat model not found for session');
			}

			const request = model.getRequests().at(-1);
			if (!request) {
				return quizToolResultError('No request found in chat session');
			}

			// Signal code block start (aligned with Copilot's EditTool)
			model.acceptResponseProgress(request, {
				kind: 'markdownContent',
				content: new MarkdownString('\n````\n')
			});
			model.acceptResponseProgress(request, {
				kind: 'codeblockUri',
				uri,
				isEdit: true
			});
			model.acceptResponseProgress(request, {
				kind: 'markdownContent',
				content: new MarkdownString('\n````\n')
			});

			// Signal start of edit stream (aligned with Copilot's EditTool)
			if (this._notebookService.hasSupportedNotebooks(uri) && (this._notebookService.getNotebookTextModel(uri))) {
				model.acceptResponseProgress(request, {
					kind: 'notebookEdit',
					edits: [],
					uri
				});
			} else {
				model.acceptResponseProgress(request, {
					kind: 'textEdit',
					edits: [],
					uri
				});
			}

			// Use ICodeMapperService to apply edits (aligned with Copilot's EditTool)
			const result = await this._codeMapperService.mapCode({
				codeBlocks: [{ code: parameters.code, resource: uri, markdownBeforeBlock: parameters.explanation }],
				location: 'tool',
				chatRequestId: context.requestId,
				chatRequestModel: undefined,
				chatSessionResource,
			}, {
				textEdit: (target: URI, edits: TextEdit[]) => {
					model.acceptResponseProgress(request, { kind: 'textEdit', uri: target, edits });
				},
				notebookEdit: (target: URI, edits: ICellEditOperation[]) => {
					model.acceptResponseProgress(request, { kind: 'notebookEdit', uri: target, edits });
				},
			}, token);

			// Signal end of edit stream (aligned with Copilot's EditTool)
			if (this._notebookService.hasSupportedNotebooks(uri) && (this._notebookService.getNotebookTextModel(uri))) {
				model.acceptResponseProgress(request, { kind: 'notebookEdit', uri, edits: [], done: true });
			} else {
				model.acceptResponseProgress(request, { kind: 'textEdit', uri, edits: [], done: true });
			}

			if (result?.errorMessage) {
				return quizToolResultError(result.errorMessage);
			}

			// Wait for the editing session to finish applying (aligned with Copilot's EditTool)
			const editSession = model.editingSession;
			if (editSession) {
				let dispose: IDisposable;
				await new Promise<boolean>((resolve) => {
					let wasFileBeingModified = false;
					dispose = autorun((r) => {
						const entries = editSession.entries.read(r);
						const currentFile = entries?.find((e) => isEqual(e.modifiedURI, uri));
						if (currentFile) {
							if (currentFile.isCurrentlyBeingModifiedBy.read(r)) {
								wasFileBeingModified = true;
							} else if (wasFileBeingModified) {
								resolve(true);
							}
						}
					});
				}).finally(() => {
					dispose.dispose();
				});
			}

			return quizToolResultText('The file was edited successfully');
		} catch (err) {
			if (err instanceof Error && err.message.includes('editing session')) {
				return quizToolResultError('This tool must be called from within an editing session');
			}
			return quizToolResultError(`Failed to apply edit: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizInsertEditInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const uri = URI.revive(parameters.uri);
		return {
			invocationMessage: `Editing ${uri.fsPath}`,
		};
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

			// Use fuzzy matching (aligned with Copilot's editFileHealing)
			const match = fuzzyFindText(content, parameters.oldText);
			if (!match) {
				return quizToolResultError(`Text not found in ${parameters.filePath}: "${parameters.oldText.substring(0, 80)}..."`);
			}

			// Find the line/column position from offset
			const startPos = offsetToPosition(content, match.offset);
			const endPos = offsetToPosition(content, match.offset + match.actualText.length);

			model.applyEdits([{
				range: { startLineNumber: startPos.line, startColumn: startPos.column, endLineNumber: endPos.line, endColumn: endPos.column },
				text: parameters.newText,
			}]);

			await this._textFileService.save(uri);

			const wasFuzzy = match.actualText !== parameters.oldText;
			const suffix = wasFuzzy ? ' (fuzzy match — whitespace differed)' : '';
			return quizToolResultText(`Replace applied in ${parameters.filePath}${suffix}`);
		} catch (err) {
			return quizToolResultError(`Failed to apply replace: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizReplaceStringInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Apply text replacement?',
				message: `Replace in \`${parameters.filePath}\`:\n\`\`\`\n${parameters.oldText.substring(0, 200)}${parameters.oldText.length > 200 ? '...' : ''}\n\`\`\`\n→\n\`\`\`\n${parameters.newText.substring(0, 200)}${parameters.newText.length > 200 ? '...' : ''}\n\`\`\``,
			},
			invocationMessage: `Replacing text in ${parameters.filePath}`,
		};
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
			const content = model.getValue();

			// Apply replacements in reverse order (aligned with Copilot's multiReplaceStringTool)
			// to preserve earlier offsets when later replacements change content length
			const matches: { offset: number; actualText: string; newText: string; fuzzy: boolean }[] = [];
			const notFound: string[] = [];

			for (const replacement of parameters.replacements) {
				const match = fuzzyFindText(content, replacement.oldText);
				if (!match) {
					notFound.push(replacement.oldText.substring(0, 50));
					continue;
				}
				matches.push({
					offset: match.offset,
					actualText: match.actualText,
					newText: replacement.newText,
					fuzzy: match.actualText !== replacement.oldText,
				});
			}

			// Sort by offset descending (reverse order) to preserve positions
			matches.sort((a, b) => b.offset - a.offset);

			// Apply edits in reverse order using model.applyEdits
			const edits = matches.map(m => {
				const startPos = offsetToPosition(content, m.offset);
				const endPos = offsetToPosition(content, m.offset + m.actualText.length);
				return {
					range: { startLineNumber: startPos.line, startColumn: startPos.column, endLineNumber: endPos.line, endColumn: endPos.column },
					text: m.newText,
				};
			});

			model.applyEdits(edits);
			await this._textFileService.save(uri);

			const fuzzyCount = matches.filter(m => m.fuzzy).length;
			const applied = matches.length;
			const result = `Multi-replace applied in ${parameters.filePath}: ${applied} of ${parameters.replacements.length} replacements succeeded`;
			const extras: string[] = [];
			if (fuzzyCount > 0) {
				extras.push(`${fuzzyCount} fuzzy match${fuzzyCount > 1 ? 'es' : ''}`);
			}
			if (notFound.length > 0) {
				extras.push(`Not found: ${notFound.join('; ')}`);
			}
			return quizToolResultText(extras.length > 0 ? `${result} (${extras.join(', ')})` : result);
		} catch (err) {
			return quizToolResultError(`Failed to apply multi-replace: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizMultiReplaceStringInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Apply multiple replacements?',
				message: `Apply ${parameters.replacements.length} replacement(s) in \`${parameters.filePath}\``,
			},
			invocationMessage: `Applying ${parameters.replacements.length} replacements in ${parameters.filePath}`,
		};
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
			// Enhanced implementation — handles hunk-by-hunk application with healing
			const fileChanges = this._parseUnifiedDiff(parameters.patch);
			const results: string[] = [];
			const warnings: string[] = [];

			for (const fileChange of fileChanges) {
				const uri = URI.file(fileChange.filePath);
				const exists = await this._fileService.exists(uri);

				if (!exists && fileChange.isNewFile) {
					// Create parent directories if needed (aligned with Copilot's createFileTool)
					const dirUri = URI.joinPath(uri, '..');
					try {
						await this._fileService.createFolder(dirUri);
					} catch {
						// Directory may already exist
					}
					await this._fileService.writeFile(uri, VSBuffer.fromString(fileChange.newContent));
					results.push(`Created: ${fileChange.filePath}`);
				} else if (exists && fileChange.isDeleted) {
					await this._fileService.del(uri);
					results.push(`Deleted: ${fileChange.filePath}`);
				} else if (exists) {
					const textFile = this._textFileService.files.get(uri);
					if (textFile?.textEditorModel) {
						// Apply hunks to the model (aligned with Copilot's hunk-by-hunk application)
						const model = textFile.textEditorModel;
						// If the patch contains the full new content, use it directly
						if (fileChange.newContent !== undefined && fileChange.hunks.length === 0) {
							model.setValue(fileChange.newContent);
						} else {
							// Apply individual hunks in reverse order to preserve positions
							const sortedHunks = [...fileChange.hunks].sort((a, b) => b.newStart - a.newStart);
							for (const hunk of sortedHunks) {
								const startLine = hunk.newStart;
								const endLine = hunk.newStart + hunk.newCount - 1;
								const hunkContent = hunk.newLines.join('\n');

								// Validate line range
								const lineCount = model.getLineCount();
								if (startLine > lineCount) {
									warnings.push(`Hunk at line ${startLine} exceeds file length (${lineCount}) in ${fileChange.filePath}`);
									continue;
								}

								const clampedEnd = Math.min(endLine, lineCount);
								model.applyEdits([{
									range: { startLineNumber: startLine, startColumn: 1, endLineNumber: clampedEnd, endColumn: model.getLineMaxColumn(clampedEnd) },
									text: hunkContent,
								}]);
							}
						}

						await this._textFileService.save(uri);
						results.push(`Modified: ${fileChange.filePath}`);
					} else {
						// File not open in editor — write directly
						await this._fileService.writeFile(uri, VSBuffer.fromString(fileChange.newContent ?? ''));
						results.push(`Written: ${fileChange.filePath}`);
					}
				} else {
					warnings.push(`File not found: ${fileChange.filePath}`);
				}
			}

			let result = results.join('\n') || 'Patch applied (no files changed)';
			if (warnings.length > 0) {
				result += `\nWarnings: ${warnings.join('; ')}`;
			}
			return quizToolResultText(result);
		} catch (err) {
			return quizToolResultError(`Failed to apply patch: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizApplyPatchInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const fileCount = this._parseUnifiedDiff(parameters.patch).length;
		return {
			confirmationMessages: {
				title: 'Apply patch?',
				message: `Apply patch affecting ${fileCount} file${fileCount === 1 ? '' : 's'}?`,
			},
			invocationMessage: `Applying patch (${fileCount} file${fileCount === 1 ? '' : 's'})`,
		};
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}

	/**
	 * Enhanced unified diff parser.
	 * Extracts file paths, hunk information, and final content.
	 * Supports hunk-by-hunk application for more precise patching.
	 * Aligned with Copilot's applyPatch parser structure.
	 */
	private _parseUnifiedDiff(patch: string): { filePath: string; isNewFile: boolean; isDeleted: boolean; newContent: string; hunks: { newStart: number; newCount: number; newLines: string[] }[] }[] {
		const results: { filePath: string; isNewFile: boolean; isDeleted: boolean; newContent: string; hunks: { newStart: number; newCount: number; newLines: string[] }[] }[] = [];
		const lines = patch.split('\n');
		let currentFile: string | undefined;
		let isNewFile = false;
		let isDeleted = false;
		let currentContentLines: string[] = [];
		let currentHunks: { newStart: number; newCount: number; newLines: string[] }[] = [];
		let inHunk = false;
		let currentHunkNewStart = 0;
		let currentHunkNewCount = 0;
		let currentHunkNewLines: string[] = [];

		const finishHunk = () => {
			if (inHunk && currentHunkNewLines.length > 0) {
				currentHunks.push({
					newStart: currentHunkNewStart,
					newCount: currentHunkNewCount,
					newLines: currentHunkNewLines,
				});
			}
			inHunk = false;
			currentHunkNewLines = [];
		};

		const finishFile = () => {
			finishHunk();
			if (currentFile) {
				results.push({
					filePath: currentFile,
					isNewFile,
					isDeleted,
					newContent: currentContentLines.join('\n'),
					hunks: currentHunks,
				});
			}
			currentContentLines = [];
			currentHunks = [];
			isNewFile = false;
			isDeleted = false;
		};

		for (const line of lines) {
			// File header: --- a/file
			const fileMatch = line.match(/^--- (?:a\/)?(.+)$/);
			if (fileMatch) {
				finishFile();
				const filePath = fileMatch[1];
				if (filePath === '/dev/null') {
					isNewFile = true;
				}
				continue;
			}

			// File header: +++ b/file
			const newFileMatch = line.match(/^\+\+\+ (?:b\/)?(.+)$/);
			if (newFileMatch) {
				currentFile = newFileMatch[1];
				if (newFileMatch[1] === '/dev/null') {
					isDeleted = true;
				}
				continue;
			}

			// Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
			const hunkMatch = line.match(/^@@@\s*-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s*@@@?/);
			if (hunkMatch) {
				finishHunk();
				inHunk = true;
				currentHunkNewStart = parseInt(hunkMatch[1], 10);
				currentHunkNewCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
				currentHunkNewLines = [];
				continue;
			}

			// Content lines
			if (line.startsWith('+') && !line.startsWith('+++')) {
				currentContentLines.push(line.substring(1));
				if (inHunk) {
					currentHunkNewLines.push(line.substring(1));
				}
			} else if (line.startsWith(' ')) {
				currentContentLines.push(line.substring(1));
				if (inHunk) {
					currentHunkNewLines.push(line.substring(1));
				}
			}
			// Skip '-' lines (removed), '@@' lines (hunk headers), and other metadata
		}

		finishFile();
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
	chatService: IChatService,
	codeMapperService: ICodeMapperService,
	notebookService: INotebookService,
): void {
	QuizBuiltinToolRegistry.register(new QuizInsertEditToolImpl(chatService, codeMapperService, notebookService));
	QuizBuiltinToolRegistry.register(new QuizReplaceStringToolImpl(textFileService));
	QuizBuiltinToolRegistry.register(new QuizMultiReplaceStringToolImpl(textFileService));
	QuizBuiltinToolRegistry.register(new QuizApplyPatchToolImpl(textFileService, fileService));
}
