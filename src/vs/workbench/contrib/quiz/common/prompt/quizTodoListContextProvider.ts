/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/todoListContextProvider.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizTodoListContextProvider = createDecorator<IQuizTodoListContextProvider>('quizTodoListContextProvider');

// #region Todo list item types (aligned with Copilot's todo list tool schema)

/**
 * A single item in the todo list.
 * Aligned with Copilot's ManageTodoList tool item schema.
 */
export interface IQuizTodoItem {
	/** Unique identifier for the item */
	readonly id: string;
	/** The text content of the todo item */
	readonly content: string;
	/** Whether the item is completed */
	readonly completed: boolean;
	/** Optional status label (e.g. 'in_progress') */
	readonly status?: string;
}

/**
 * The full todo list context for a session.
 */
export interface IQuizTodoListContext {
	/** The session resource this todo list belongs to */
	readonly sessionResource: string;
	/** The items in the todo list */
	readonly items: readonly IQuizTodoItem[];
}

// #endregion

// #region IQuizTodoListContextProvider

/**
 * Provides todo list context for chat sessions.
 * Aligned with Copilot's ITodoListContextProvider (prompt/node/todoListContextProvider.ts).
 */
export interface IQuizTodoListContextProvider {
	readonly _serviceBrand: undefined;

	/**
	 * Get the current todo list context as a formatted string for prompt injection.
	 * Aligned with Copilot's ITodoListContextProvider.getCurrentTodoContext.
	 */
	getCurrentTodoContext(sessionResource: string, token?: CancellationToken): Promise<string | undefined>;

	/**
	 * Get the structured todo list for a session.
	 */
	getTodoList(sessionResource: string, token?: CancellationToken): Promise<IQuizTodoListContext | undefined>;
}

// #endregion

// #region Null implementation

/**
 * Null implementation.
 */
export class NullQuizTodoListContextProvider implements IQuizTodoListContextProvider {
	declare readonly _serviceBrand: undefined;

	async getCurrentTodoContext(_sessionResource: string, _token?: CancellationToken): Promise<string | undefined> {
		return undefined;
	}

	async getTodoList(_sessionResource: string, _token?: CancellationToken): Promise<IQuizTodoListContext | undefined> {
		return undefined;
	}
}

// #endregion
