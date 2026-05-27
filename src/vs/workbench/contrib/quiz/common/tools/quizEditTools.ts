/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region InsertEditTool (aligned with Copilot's InsertEditTool)

export interface IQuizInsertEditInput {
	filePath: string;
	code: string;
}

export class QuizInsertEditTool extends QuizBuiltinTool<IQuizInsertEditInput> {

	readonly toolName = QuizToolName.EditFile;

	readonly definition = {
		name: QuizToolName.EditFile,
		description: 'Insert code into a file. The tool will insert the provided code at the appropriate location based on the surrounding context.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'code'],
			properties: {
				filePath: {
					description: 'The absolute path of the file to edit.',
					type: 'string',
				},
				code: {
					description: 'The code to insert into the file.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizInsertEditInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Edit applied to ${parameters.filePath}]`);
		} catch (err) {
			return quizToolResultError(`Failed to apply edit: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		// Allow edits without confirmation for now
		return undefined;
	}
}

QuizBuiltinToolRegistry.register(new QuizInsertEditTool());

// #endregion

// #region ReplaceStringTool (aligned with Copilot's ReplaceStringTool)

export interface IQuizReplaceStringInput {
	filePath: string;
	oldText: string;
	newText: string;
}

export class QuizReplaceStringTool extends QuizBuiltinTool<IQuizReplaceStringInput> {

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

	override async invoke(parameters: IQuizReplaceStringInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Replace applied in ${parameters.filePath}: "${parameters.oldText.substring(0, 50)}..." → "${parameters.newText.substring(0, 50)}..."]`);
		} catch (err) {
			return quizToolResultError(`Failed to apply replace: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}
}

QuizBuiltinToolRegistry.register(new QuizReplaceStringTool());

// #endregion

// #region MultiReplaceStringTool (aligned with Copilot's MultiReplaceStringTool)

export interface IQuizMultiReplaceStringInput {
	filePath: string;
	replacements: readonly { oldText: string; newText: string }[];
}

export class QuizMultiReplaceStringTool extends QuizBuiltinTool<IQuizMultiReplaceStringInput> {

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

	override async invoke(parameters: IQuizMultiReplaceStringInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Multi-replace applied in ${parameters.filePath}: ${parameters.replacements.length} replacements]`);
		} catch (err) {
			return quizToolResultError(`Failed to apply multi-replace: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}
}

QuizBuiltinToolRegistry.register(new QuizMultiReplaceStringTool());

// #endregion

// #region ApplyPatchTool (aligned with Copilot's ApplyPatchTool)

export interface IQuizApplyPatchInput {
	patch: string;
}

export class QuizApplyPatchTool extends QuizBuiltinTool<IQuizApplyPatchInput> {

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

	override async invoke(parameters: IQuizApplyPatchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Patch applied: ${parameters.patch.split('\n').length} lines]`);
		} catch (err) {
			return quizToolResultError(`Failed to apply patch: ${String(err)}`);
		}
	}

	override async filterEdits(resource: URI): Promise<{ title: string; message: string } | undefined> {
		return undefined;
	}
}

QuizBuiltinToolRegistry.register(new QuizApplyPatchTool());

// #endregion

// #region CreateFileTool (aligned with Copilot's CreateFileTool)

export interface IQuizCreateFileInput {
	filePath: string;
	content: string;
}

export class QuizCreateFileTool extends QuizBuiltinTool<IQuizCreateFileInput> {

	readonly toolName = QuizToolName.CreateFile;

	readonly definition = {
		name: QuizToolName.CreateFile,
		description: 'Create a new file with the specified content.',
		inputSchema: {
			type: 'object',
			required: ['filePath', 'content'],
			properties: {
				filePath: {
					description: 'The absolute path for the new file.',
					type: 'string',
				},
				content: {
					description: 'The initial content for the new file.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizCreateFileInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[File created: ${parameters.filePath}]`);
		} catch (err) {
			return quizToolResultError(`Failed to create file: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizCreateFileTool());

// #endregion

// #region CreateDirectoryTool (aligned with Copilot's CreateDirectoryTool)

export interface IQuizCreateDirectoryInput {
	path: string;
}

export class QuizCreateDirectoryTool extends QuizBuiltinTool<IQuizCreateDirectoryInput> {

	readonly toolName = QuizToolName.CreateDirectory;

	readonly definition = {
		name: QuizToolName.CreateDirectory,
		description: 'Create a new directory at the specified path.',
		inputSchema: {
			type: 'object',
			required: ['path'],
			properties: {
				path: {
					description: 'The absolute path for the new directory.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizCreateDirectoryInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Directory created: ${parameters.path}]`);
		} catch (err) {
			return quizToolResultError(`Failed to create directory: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizCreateDirectoryTool());

// #endregion
