/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region SessionStoreSqlTool (aligned with Copilot's SessionStoreSqlTool)

export interface IQuizSessionStoreSqlInput {
	query: string;
}

export class QuizSessionStoreSqlTool extends QuizBuiltinTool<IQuizSessionStoreSqlInput> {

	readonly toolName = QuizToolName.SessionStoreSql;

	readonly definition = {
		name: QuizToolName.SessionStoreSql,
		description: 'Query the session store database using SQL. The session store contains information about chat sessions, turns, and tool call history. Use this to search and analyze conversation data.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The SQL query to execute against the session store. Only SELECT queries are allowed.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizSessionStoreSqlInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Only allow SELECT queries for safety
			const trimmed = parameters.query.trim().toUpperCase();
			if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
				return quizToolResultError('Only SELECT queries are allowed for session store access');
			}
			return quizToolResultText(`[SQL query results would be provided here via ISessionStoreService: ${parameters.query.substring(0, 100)}...]`);
		} catch (err) {
			return quizToolResultError(`Failed to query session store: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizSessionStoreSqlTool());

// #endregion

// #region ResolveMemoryFileUriTool (aligned with Copilot's ResolveMemoryFileUriTool)

export interface IQuizResolveMemoryFileUriInput {
	uri: string;
}

export class QuizResolveMemoryFileUriTool extends QuizBuiltinTool<IQuizResolveMemoryFileUriInput> {

	readonly toolName = QuizToolName.ResolveMemoryFileUri;

	readonly definition = {
		name: QuizToolName.ResolveMemoryFileUri,
		description: 'Resolve a memory file URI to its actual file system path. Memory files are virtual files stored in the session that may map to real workspace files.',
		inputSchema: {
			type: 'object',
			required: ['uri'],
			properties: {
				uri: {
					description: 'The memory file URI to resolve.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizResolveMemoryFileUriInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Memory file URI ${parameters.uri} would be resolved here via IUriIdentityService]`);
		} catch (err) {
			return quizToolResultError(`Failed to resolve memory file URI: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizResolveMemoryFileUriTool());

// #endregion
