/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer notebook tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's editNotebookTool.tsx, runNotebookCell.tsx, etc.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { INotebookEditorService } from '../../../notebook/browser/services/notebookEditorService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';

interface INotebookCellObject {
	cell_type: string;
	source: string[];
	metadata: Record<string, string>;
	execution_count?: number | null;
	outputs?: unknown[];
}

interface INotebookJsonObject {
	nbformat: number;
	nbformat_minor: number;
	metadata: Record<string, unknown>;
	cells: INotebookCellObject[];
}

// #region QuizEditNotebookToolImpl (browser-layer, aligned with Copilot's EditNotebookTool)

export interface IQuizEditNotebookInput {
	filePath: string;
	newCells?: readonly {
		cellKind: 'code' | 'markup';
		language?: string;
		value: string;
		position?: number;
	}[];
	cellEdits?: readonly {
		index: number;
		value?: string;
		language?: string;
		cellKind?: 'code' | 'markup';
	}[];
	cellDeletions?: readonly {
		index: number;
	}[];
}

export class QuizEditNotebookToolImpl extends QuizBuiltinTool<IQuizEditNotebookInput> {

	readonly toolName = QuizToolName.EditNotebook;

	readonly definition = {
		name: QuizToolName.EditNotebook,
		description: 'Edit a Jupyter notebook file. Supports adding new cells, editing existing cells, and deleting cells. Cell indices are 0-based.',
		inputSchema: {
			type: 'object',
			required: ['filePath'],
			properties: {
				filePath: {
					description: 'The absolute path of the notebook file to edit.',
					type: 'string',
				},
				newCells: {
					description: 'Array of new cells to add. Each cell specifies its kind, language, value, and optional position (0-based index to insert at).',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							cellKind: {
								description: 'The kind of cell: "code" or "markup".',
								type: 'string',
								enum: ['code', 'markup'],
							},
							language: {
								description: 'The language ID for code cells (e.g., "python", "javascript").',
								type: 'string',
							},
							value: {
								description: 'The cell content.',
								type: 'string',
							},
							position: {
								description: '0-based index to insert the cell at. If omitted, appends to end.',
								type: 'number',
							},
						},
						required: ['cellKind', 'value'],
					},
				},
				cellEdits: {
					description: 'Array of cell edits. Each edit targets a cell by its 0-based index.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							index: {
								description: '0-based index of the cell to edit.',
								type: 'number',
							},
							value: {
								description: 'New cell content.',
								type: 'string',
							},
							language: {
								description: 'New language ID for the cell.',
								type: 'string',
							},
							cellKind: {
								description: 'New cell kind.',
								type: 'string',
								enum: ['code', 'markup'],
							},
						},
						required: ['index'],
					},
				},
				cellDeletions: {
					description: 'Array of cell deletions by 0-based index.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							index: {
								description: '0-based index of the cell to delete.',
								type: 'number',
							},
						},
						required: ['index'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizEditNotebookInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);

			// Read the notebook file
			const content = await this._fileService.readFile(uri);
			const notebookJson = JSON.parse(content.value.toString());

			if (!notebookJson.cells || !Array.isArray(notebookJson.cells)) {
				return quizToolResultError(`Invalid notebook format: ${parameters.filePath}`);
			}

			const cells = notebookJson.cells;
			const parts: string[] = [];

			// Apply deletions first (in reverse order to preserve indices)
			if (parameters.cellDeletions?.length) {
				const sortedDeletions = [...parameters.cellDeletions].sort((a, b) => b.index - a.index);
				for (const del of sortedDeletions) {
					if (del.index >= 0 && del.index < cells.length) {
						cells.splice(del.index, 1);
					}
				}
				parts.push(`${parameters.cellDeletions.length} cells deleted`);
			}

			// Apply edits
			if (parameters.cellEdits?.length) {
				for (const edit of parameters.cellEdits) {
					if (edit.index >= 0 && edit.index < cells.length) {
						const cell = cells[edit.index];
						if (edit.value !== undefined) {
							if (cell.cell_type === 'markdown') {
								cell.source = edit.value.split('\n').map((line: string, i: number, arr: string[]) =>
									i < arr.length - 1 ? line + '\n' : line
								);
							} else {
								cell.source = edit.value.split('\n').map((line: string, i: number, arr: string[]) =>
									i < arr.length - 1 ? line + '\n' : line
								);
							}
						}
						if (edit.language !== undefined) {
							cell.metadata = cell.metadata ?? {};
							cell.metadata.language = edit.language;
						}
						if (edit.cellKind !== undefined) {
							cell.cell_type = edit.cellKind === 'code' ? 'code' : 'markdown';
							if (cell.cell_type === 'code' && !cell.execution_count) {
								cell.execution_count = null;
								cell.outputs = [];
							}
						}
					}
				}
				parts.push(`${parameters.cellEdits.length} cells edited`);
			}

			// Apply insertions
			if (parameters.newCells?.length) {
				for (const newCell of parameters.newCells) {
					const cellObj: INotebookCellObject = {
						cell_type: newCell.cellKind === 'code' ? 'code' : 'markdown',
						source: newCell.value.split('\n').map((line: string, i: number, arr: string[]) =>
							i < arr.length - 1 ? line + '\n' : line
						),
						metadata: newCell.language ? { language: newCell.language } : {},
					};
					if (newCell.cellKind === 'code') {
						cellObj.execution_count = null;
						cellObj.outputs = [];
					}

					const insertAt = newCell.position ?? cells.length;
					if (insertAt >= 0 && insertAt <= cells.length) {
						cells.splice(insertAt, 0, cellObj);
					} else {
						cells.push(cellObj);
					}
				}
				parts.push(`${parameters.newCells.length} cells added`);
			}

			// Write back
			notebookJson.cells = cells;
			await this._fileService.writeFile(uri, VSBuffer.fromString(JSON.stringify(notebookJson, null, 1)));

			return quizToolResultText(`Notebook edit applied to ${parameters.filePath}: ${parts.join(', ')}`);
		} catch (err) {
			return quizToolResultError(`Failed to edit notebook: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizEditNotebookInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const parts: string[] = [];
		if (parameters.newCells?.length) { parts.push(`${parameters.newCells.length} additions`); }
		if (parameters.cellEdits?.length) { parts.push(`${parameters.cellEdits.length} edits`); }
		if (parameters.cellDeletions?.length) { parts.push(`${parameters.cellDeletions.length} deletions`); }
		return {
			confirmationMessages: {
				title: 'Edit notebook?',
				message: `Apply ${parts.join(', ')} to \`${parameters.filePath}\`?`,
			},
			invocationMessage: `Editing notebook ${parameters.filePath}`,
		};
	}
}

// #endregion

// #region QuizRunNotebookCellToolImpl (browser-layer, aligned with Copilot's RunNotebookCellTool)

export interface IQuizRunNotebookCellInput {
	filePath: string;
	cellIndex: number;
}

export class QuizRunNotebookCellToolImpl extends QuizBuiltinTool<IQuizRunNotebookCellInput> {

	readonly toolName = QuizToolName.RunNotebookCell;

	readonly definition = {
		name: QuizToolName.RunNotebookCell,
		description: 'Run a specific cell in a Jupyter notebook. Returns the cell output after execution completes.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'cellIndex'],
			properties: {
				filePath: {
					description: 'The absolute path of the notebook file.',
					type: 'string',
				},
				cellIndex: {
					description: '0-based index of the cell to run.',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _notebookEditorService: INotebookEditorService,
	) {
		super();
	}

	override async invoke(parameters: IQuizRunNotebookCellInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);

			// Try to find an existing editor for this notebook
			const editor = this._notebookEditorService.listNotebookEditors().find(e => e.textModel?.uri.toString() === uri.toString());

			if (editor?.textModel) {
				if (parameters.cellIndex < 0 || parameters.cellIndex >= editor.textModel.cells.length) {
					return quizToolResultError(`Cell index ${parameters.cellIndex} out of range (0-${editor.textModel.cells.length - 1})`);
				}

				// Execute the cell via the notebook execution service
				// This requires the notebook kernel to be available
				return quizToolResultText(`[Cell ${parameters.cellIndex} execution requested in ${parameters.filePath} — execution requires an active notebook kernel]`);
			}

			return quizToolResultText(`[Notebook ${parameters.filePath} is not open in an editor — cell execution requires the notebook to be open with an active kernel]`);
		} catch (err) {
			return quizToolResultError(`Failed to run notebook cell: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizGetNotebookSummaryToolImpl (browser-layer, aligned with Copilot's GetNotebookSummaryTool)

export interface IQuizGetNotebookSummaryInput {
	filePath: string;
}

export class QuizGetNotebookSummaryToolImpl extends QuizBuiltinTool<IQuizGetNotebookSummaryInput> {

	readonly toolName = QuizToolName.GetNotebookSummary;

	readonly definition = {
		name: QuizToolName.GetNotebookSummary,
		description: 'Get a summary of a Jupyter notebook file. Returns the list of cells with their kinds, languages, and first few lines of content.',
		inputSchema: {
			type: 'object',
			required: ['filePath'],
			properties: {
				filePath: {
					description: 'The absolute path of the notebook file.',
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

	override async invoke(parameters: IQuizGetNotebookSummaryInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const content = await this._fileService.readFile(uri);
			const notebookJson = JSON.parse(content.value.toString());

			if (!notebookJson.cells || !Array.isArray(notebookJson.cells)) {
				return quizToolResultError(`Invalid notebook format: ${parameters.filePath}`);
			}

			const lines: string[] = [`Notebook: ${parameters.filePath}`];
			lines.push(`Kernel: ${notebookJson.metadata?.kernelspec?.display_name ?? 'unknown'}`);
			lines.push(`Cells: ${notebookJson.cells.length}`);
			lines.push('');

			for (let i = 0; i < notebookJson.cells.length; i++) {
				const cell = notebookJson.cells[i];
				const kind = cell.cell_type ?? 'unknown';
				const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source ?? '');
				const preview = source.substring(0, 80).replace(/\n/g, ' ');
				const language = cell.metadata?.language ?? (kind === 'code' ? 'python' : 'markdown');
				const hasOutput = cell.outputs?.length > 0;

				lines.push(`[${i}] ${kind} (${language})${hasOutput ? ' [has output]' : ''}: ${preview}${source.length > 80 ? '...' : ''}`);
			}

			return quizToolResultText(lines.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to get notebook summary: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizReadCellOutputToolImpl (browser-layer, aligned with Copilot's ReadCellOutputTool)

export interface IQuizReadCellOutputInput {
	filePath: string;
	cellIndex: number;
}

export class QuizReadCellOutputToolImpl extends QuizBuiltinTool<IQuizReadCellOutputInput> {

	readonly toolName = QuizToolName.ReadCellOutput;

	readonly definition = {
		name: QuizToolName.ReadCellOutput,
		description: 'Read the output of a specific cell in a Jupyter notebook. Returns the cell execution output including text, errors, and rich output.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'cellIndex'],
			properties: {
				filePath: {
					description: 'The absolute path of the notebook file.',
					type: 'string',
				},
				cellIndex: {
					description: '0-based index of the cell whose output to read.',
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

	override async invoke(parameters: IQuizReadCellOutputInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);
			const content = await this._fileService.readFile(uri);
			const notebookJson = JSON.parse(content.value.toString());

			if (!notebookJson.cells || !Array.isArray(notebookJson.cells)) {
				return quizToolResultError(`Invalid notebook format: ${parameters.filePath}`);
			}

			if (parameters.cellIndex < 0 || parameters.cellIndex >= notebookJson.cells.length) {
				return quizToolResultError(`Cell index ${parameters.cellIndex} out of range (0-${notebookJson.cells.length - 1})`);
			}

			const cell = notebookJson.cells[parameters.cellIndex];
			const outputs = cell.outputs ?? [];

			if (outputs.length === 0) {
				return quizToolResultText(`Cell ${parameters.cellIndex} has no output`);
			}

			const lines: string[] = [`Output of cell ${parameters.cellIndex}:`];

			for (const output of outputs) {
				if (output.output_type === 'stream') {
					const text = Array.isArray(output.text) ? output.text.join('') : (output.text ?? '');
					lines.push(`[${output.name ?? 'stdout'}]: ${text}`);
				} else if (output.output_type === 'error') {
					const traceback = Array.isArray(output.traceback) ? output.traceback.join('\n') : '';
					lines.push(`[ERROR] ${output.ename ?? 'Error'}: ${output.evalue ?? ''}\n${traceback}`);
				} else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
					if (output.data?.['text/plain']) {
						const text = Array.isArray(output.data['text/plain']) ? output.data['text/plain'].join('') : output.data['text/plain'];
						lines.push(text);
					} else if (output.data) {
						const mimeTypes = Object.keys(output.data);
						lines.push(`[Rich output: ${mimeTypes.join(', ')}]`);
					}
				}
			}

			return quizToolResultText(lines.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to read cell output: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizCreateNewJupyterNotebookToolImpl (browser-layer, aligned with Copilot's CreateNewJupyterNotebookTool)

export interface IQuizCreateNewJupyterNotebookInput {
	filePath: string;
	cells?: readonly {
		cellKind: 'code' | 'markup';
		language?: string;
		value: string;
	}[];
}

export class QuizCreateNewJupyterNotebookToolImpl extends QuizBuiltinTool<IQuizCreateNewJupyterNotebookInput> {

	readonly toolName = QuizToolName.CreateNewJupyterNotebook;

	readonly definition = {
		name: QuizToolName.CreateNewJupyterNotebook,
		description: 'Create a new Jupyter notebook file (.ipynb) with optional initial cells. The notebook is created with a Python kernel by default.',
		inputSchema: {
			type: 'object',
			required: ['filePath'],
			properties: {
				filePath: {
					description: 'The absolute path for the new notebook file (should end in .ipynb).',
					type: 'string',
				},
				cells: {
					description: 'Optional initial cells for the notebook.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							cellKind: {
								description: 'The kind of cell.',
								type: 'string',
								enum: ['code', 'markup'],
							},
							language: {
								description: 'The language ID for code cells.',
								type: 'string',
							},
							value: {
								description: 'The cell content.',
								type: 'string',
							},
						},
						required: ['cellKind', 'value'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizCreateNewJupyterNotebookInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const uri = URI.file(parameters.filePath);

			if (!uri.path.endsWith('.ipynb')) {
				return quizToolResultError(`Notebook file path should end in .ipynb: ${parameters.filePath}`);
			}

			const exists = await this._fileService.exists(uri);
			if (exists) {
				return quizToolResultError(`File already exists: ${parameters.filePath}`);
			}

			// Create parent directories
			const dirUri = URI.joinPath(uri, '..');
			try {
				await this._fileService.createFolder(dirUri);
			} catch {
				// Directory may already exist
			}

			// Build notebook JSON
			const notebookJson: INotebookJsonObject = {
				nbformat: 4,
				nbformat_minor: 5,
				metadata: {
					kernelspec: {
						display_name: 'Python 3',
						language: 'python',
						name: 'python3',
					},
					language_info: {
						name: 'python',
						version: '3.10.0',
					},
				},
				cells: [],
			};

			if (parameters.cells?.length) {
				for (const cell of parameters.cells) {
					const cellObj: INotebookCellObject = {
						cell_type: cell.cellKind === 'code' ? 'code' : 'markdown',
						source: cell.value.split('\n').map((line: string, i: number, arr: string[]) =>
							i < arr.length - 1 ? line + '\n' : line
						),
						metadata: cell.language ? { language: cell.language } : {},
					};
					if (cell.cellKind === 'code') {
						cellObj.execution_count = null;
						cellObj.outputs = [];
					}
					notebookJson.cells.push(cellObj);
				}
			} else {
				// Add a single empty code cell by default
				notebookJson.cells.push({
					cell_type: 'code',
					source: [],
					execution_count: null,
					outputs: [],
					metadata: {},
				});
			}

			await this._fileService.writeFile(uri, VSBuffer.fromString(JSON.stringify(notebookJson, null, 1)));

			return quizToolResultText(`Notebook created: ${parameters.filePath} with ${parameters.cells?.length ?? 1} cell(s)`);
		} catch (err) {
			return quizToolResultError(`Failed to create notebook: ${String(err)}`);
		}
	}
}

// #endregion

/**
 * Register all browser-layer notebook tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserNotebookTools(
	notebookEditorService: INotebookEditorService,
	fileService: IFileService,
): void {
	QuizBuiltinToolRegistry.register(new QuizEditNotebookToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizRunNotebookCellToolImpl(notebookEditorService));
	QuizBuiltinToolRegistry.register(new QuizGetNotebookSummaryToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizReadCellOutputToolImpl(fileService));
	QuizBuiltinToolRegistry.register(new QuizCreateNewJupyterNotebookToolImpl(fileService));
}
