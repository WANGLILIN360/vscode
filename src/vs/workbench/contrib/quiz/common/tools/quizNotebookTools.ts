/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region EditNotebookTool (aligned with Copilot's EditNotebookTool)

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

export class QuizEditNotebookTool extends QuizBuiltinTool<IQuizEditNotebookInput> {

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

	override async invoke(parameters: IQuizEditNotebookInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const parts: string[] = [];
			if (parameters.newCells?.length) {
				parts.push(`${parameters.newCells.length} cells added`);
			}
			if (parameters.cellEdits?.length) {
				parts.push(`${parameters.cellEdits.length} cells edited`);
			}
			if (parameters.cellDeletions?.length) {
				parts.push(`${parameters.cellDeletions.length} cells deleted`);
			}
			return quizToolResultText(`[Notebook edit applied to ${parameters.filePath}: ${parts.join(', ')} would be executed here via INotebookService]`);
		} catch (err) {
			return quizToolResultError(`Failed to edit notebook: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizEditNotebookTool());

// #endregion

// #region RunNotebookCellTool (aligned with Copilot's RunNotebookCellTool)

export interface IQuizRunNotebookCellInput {
	filePath: string;
	cellIndex: number;
}

export class QuizRunNotebookCellTool extends QuizBuiltinTool<IQuizRunNotebookCellInput> {

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

	override async invoke(parameters: IQuizRunNotebookCellInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Notebook cell ${parameters.cellIndex} in ${parameters.filePath} would be executed here via INotebookExecutionService]`);
		} catch (err) {
			return quizToolResultError(`Failed to run notebook cell: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizRunNotebookCellTool());

// #endregion

// #region GetNotebookSummaryTool (aligned with Copilot's GetNotebookSummaryTool)

export interface IQuizGetNotebookSummaryInput {
	filePath: string;
}

export class QuizGetNotebookSummaryTool extends QuizBuiltinTool<IQuizGetNotebookSummaryInput> {

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

	override async invoke(parameters: IQuizGetNotebookSummaryInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Notebook summary for ${parameters.filePath} would be retrieved here via INotebookService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get notebook summary: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizGetNotebookSummaryTool());

// #endregion

// #region ReadCellOutputTool (aligned with Copilot's ReadCellOutputTool)

export interface IQuizReadCellOutputInput {
	filePath: string;
	cellIndex: number;
}

export class QuizReadCellOutputTool extends QuizBuiltinTool<IQuizReadCellOutputInput> {

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

	override async invoke(parameters: IQuizReadCellOutputInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Cell ${parameters.cellIndex} output in ${parameters.filePath} would be read here via INotebookService]`);
		} catch (err) {
			return quizToolResultError(`Failed to read cell output: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizReadCellOutputTool());

// #endregion

// #region CreateNewJupyterNotebookTool (aligned with Copilot's CreateNewJupyterNotebookTool)

export interface IQuizCreateNewJupyterNotebookInput {
	filePath: string;
	cells?: readonly {
		cellKind: 'code' | 'markup';
		language?: string;
		value: string;
	}[];
}

export class QuizCreateNewJupyterNotebookTool extends QuizBuiltinTool<IQuizCreateNewJupyterNotebookInput> {

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

	override async invoke(parameters: IQuizCreateNewJupyterNotebookInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Notebook ${parameters.filePath} would be created here via INotebookService with ${parameters.cells?.length ?? 0} initial cells]`);
		} catch (err) {
			return quizToolResultError(`Failed to create notebook: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizCreateNewJupyterNotebookTool());

// #endregion
