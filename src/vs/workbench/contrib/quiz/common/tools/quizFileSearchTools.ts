/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region ListDirTool (aligned with Copilot's ListDirTool)

export interface IQuizListDirInput {
	path: string;
}

export class QuizListDirTool extends QuizBuiltinTool<IQuizListDirInput> {

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

	override async invoke(parameters: IQuizListDirInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Directory listing of ${parameters.path} would be read here via IFileService]`);
		} catch (err) {
			return quizToolResultError(`Failed to list directory: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizListDirTool());

// #endregion

// #region FindFilesTool (aligned with Copilot's FindFilesTool)

export interface IQuizFindFilesInput {
	pattern: string;
	excludePatterns?: string[];
}

export class QuizFindFilesTool extends QuizBuiltinTool<IQuizFindFilesInput> {

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

	override async invoke(parameters: IQuizFindFilesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[File search results for pattern "${parameters.pattern}" would be provided here via IWorkspaceFolderService]`);
		} catch (err) {
			return quizToolResultError(`Failed to find files: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizFindFilesTool());

// #endregion

// #region FindTextInFilesTool (aligned with Copilot's FindTextInFilesTool)

export interface IQuizFindTextInFilesInput {
	query: string;
	filePattern?: string;
	includeUris?: string[];
}

export class QuizFindTextInFilesTool extends QuizBuiltinTool<IQuizFindTextInFilesInput> {

	readonly toolName = QuizToolName.FindTextInFiles;

	readonly definition = {
		name: QuizToolName.FindTextInFiles,
		description: 'Search for text in files across the workspace. Returns matching file paths, line numbers, and surrounding context.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The text to search for.',
					type: 'string',
				},
				filePattern: {
					description: 'Optional glob pattern to filter files (e.g., "*.ts").',
					type: 'string',
				},
				includeUris: {
					description: 'Optional list of file URIs to search within.',
					type: 'array',
					items: { type: 'string' },
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizFindTextInFilesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Text search results for "${parameters.query}" would be provided here via ITextSearchService]`);
		} catch (err) {
			return quizToolResultError(`Failed to search text: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizFindTextInFilesTool());

// #endregion
