/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

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

	override async invoke(parameters: IQuizReadFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const offset = parameters.offset ?? 1;
			const limit = parameters.limit ?? MAX_OUTPUT_LINES;
			return quizToolResultText(`[File content of ${parameters.filePath} (lines ${offset}-${offset + limit - 1}) would be read here via IFileService]`);
		} catch (err) {
			return quizToolResultError(`Failed to read file: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizReadFileTool());

// #endregion
