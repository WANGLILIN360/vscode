/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/promptVariablesService.ts

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizPromptVariablesService = createDecorator<IQuizPromptVariablesService>('quizPromptVariablesService');

export interface IQuizPromptVariablesService {
	readonly _serviceBrand: undefined;

	/**
	 * Resolves template variables (e.g. {{VARIABLE_NAME}}) in the given message.
	 */
	resolveVariablesInPrompt(message: string, variables: readonly IQuizPromptVariableReference[]): Promise<{ message: string }>;

	/**
	 * Resolves tool references in the given message.
	 */
	resolveToolReferencesInPrompt(message: string, toolReferences: readonly IQuizToolReference[]): Promise<string>;

	/**
	 * Builds a context string describing resolved template variables for
	 * injection into system prompts.
	 */
	buildTemplateVariablesContext(sessionId: string | undefined, debugTargetSessionIds?: readonly string[]): string;
}

export interface IQuizPromptVariableReference {
	readonly id: string;
	readonly name: string;
	readonly value?: unknown;
}

export interface IQuizToolReference {
	readonly id: string;
	readonly name: string;
}

export class NullQuizPromptVariablesService implements IQuizPromptVariablesService {
	declare readonly _serviceBrand: undefined;

	async resolveVariablesInPrompt(message: string, _variables: readonly IQuizPromptVariableReference[]): Promise<{ message: string }> {
		return { message };
	}

	async resolveToolReferencesInPrompt(message: string, _toolReferences: readonly IQuizToolReference[]): Promise<string> {
		return message;
	}

	buildTemplateVariablesContext(): string {
		return '';
	}
}
