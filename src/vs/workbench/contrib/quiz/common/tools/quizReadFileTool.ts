/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region ReadFileTool (aligned with Copilot's ReadFileTool)

export interface IQuizReadFileInput {
	filePath: string;
	offset?: number;
	limit?: number;
}

const MAX_OUTPUT_LINES = 2000;

export class QuizReadFileTool extends QuizBuiltinTool<IQuizReadFileInput> {

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

	override async invoke(parameters: IQuizReadFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		// Common-layer stub — browser/node layer provides the real implementation via IFileService
		const offset = parameters.offset ?? 1;
		const limit = parameters.limit ?? MAX_OUTPUT_LINES;
		return quizToolResultText(`[Stub: File content of ${parameters.filePath} (lines ${offset}-${offset + limit - 1}) — override with browser/node layer implementation]`);
	}
}

QuizBuiltinToolRegistry.register(new QuizReadFileTool());

// #endregion
