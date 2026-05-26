/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/todoListContextProvider.ts

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizTodoListContextProvider = createDecorator<IQuizTodoListContextProvider>('quizTodoListContextProvider');

export interface IQuizTodoListContextProvider {
	readonly _serviceBrand: undefined;

	/**
	 * Get the current todo list context for a session.
	 */
	getCurrentTodoContext(sessionResource: string): Promise<string | undefined>;
}

/**
 * Null implementation.
 */
export class NullQuizTodoListContextProvider implements IQuizTodoListContextProvider {
	declare readonly _serviceBrand: undefined;

	async getCurrentTodoContext(_sessionResource: string): Promise<string | undefined> {
		return undefined;
	}
}
