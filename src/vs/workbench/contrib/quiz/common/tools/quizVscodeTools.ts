/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region RunVscodeCommandTool (aligned with Copilot's RunVscodeCommandTool)

export interface IQuizRunVscodeCommandInput {
	commandId: string;
	args?: unknown[];
}

export class QuizRunVscodeCommandTool extends QuizBuiltinTool<IQuizRunVscodeCommandInput> {

	readonly toolName = QuizToolName.RunVscodeCmd;

	readonly definition = {
		name: QuizToolName.RunVscodeCmd,
		description: 'Run a VS Code command by its ID. Returns the result of the command execution. Use this to trigger VS Code actions like formatting, refactoring, or opening views.',
		inputSchema: {
			type: 'object',
			required: ['commandId'],
			properties: {
				commandId: {
					description: 'The VS Code command ID to execute (e.g., "editor.action.formatDocument").',
					type: 'string',
				},
				args: {
					description: 'Optional arguments to pass to the command.',
					type: 'array',
					items: {},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizRunVscodeCommandInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[VS Code command "${parameters.commandId}" would be executed here via ICommandService]`);
		} catch (err) {
			return quizToolResultError(`Failed to run VS Code command: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizRunVscodeCommandInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Run VS Code command?',
				message: `The AI wants to run command: \`${parameters.commandId}\``,
			},
			invocationMessage: `Running command: ${parameters.commandId}`,
		};
	}
}

QuizBuiltinToolRegistry.register(new QuizRunVscodeCommandTool());

// #endregion

// #region ManageTodoListTool (aligned with Copilot's ManageTodoListTool)

export interface IQuizManageTodoListInput {
	todos: readonly {
		id: string;
		content: string;
		status: 'pending' | 'in_progress' | 'completed';
		priority: 'high' | 'medium' | 'low';
	}[];
}

export class QuizManageTodoListTool extends QuizBuiltinTool<IQuizManageTodoListInput> {

	readonly toolName = QuizToolName.CoreManageTodoList;

	readonly definition = {
		name: QuizToolName.CoreManageTodoList,
		description: 'Create, update, or manage a todo list for tracking task progress. Send the full updated list each time. Use this to plan and track multi-step tasks.',
		inputSchema: {
			type: 'object',
			required: ['todos'],
			properties: {
				todos: {
					description: 'The full list of todo items. Send the complete list every time — items not included will be removed.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: {
								description: 'Unique identifier for the todo item.',
								type: 'string',
							},
							content: {
								description: 'Description of the task.',
								type: 'string',
							},
							status: {
								description: 'Current status of the task.',
								type: 'string',
								enum: ['pending', 'in_progress', 'completed'],
							},
							priority: {
								description: 'Priority level of the task.',
								type: 'string',
								enum: ['high', 'medium', 'low'],
							},
						},
						required: ['id', 'content', 'status', 'priority'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizManageTodoListInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const summary = parameters.todos.map(t => `[${t.status}] ${t.content}`).join('\n');
			return quizToolResultText(`Todo list updated:\n${summary}`);
		} catch (err) {
			return quizToolResultError(`Failed to manage todo list: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizManageTodoListTool());

// #endregion

// #region ConfirmationTool (aligned with Copilot's ConfirmationTool)

export interface IQuizConfirmationInput {
	message: string;
}

export class QuizConfirmationTool extends QuizBuiltinTool<IQuizConfirmationInput> {

	readonly toolName = QuizToolName.CoreConfirmationTool;

	readonly definition = {
		name: QuizToolName.CoreConfirmationTool,
		description: 'Ask the user for confirmation before proceeding with an action. Returns true if the user confirms, false otherwise.',
		inputSchema: {
			type: 'object',
			required: ['message'],
			properties: {
				message: {
					description: 'The message to display to the user for confirmation.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizConfirmationInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Confirmation for "${parameters.message}" would be requested here via IDialogService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get confirmation: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizConfirmationTool());

// #endregion

// #region ConfirmationWithOptionsTool (aligned with Copilot's ConfirmationWithOptionsTool)

export interface IQuizConfirmationWithOptionsInput {
	message: string;
	options: readonly string[];
}

export class QuizConfirmationWithOptionsTool extends QuizBuiltinTool<IQuizConfirmationWithOptionsInput> {

	readonly toolName = QuizToolName.CoreConfirmationToolWithOptions;

	readonly definition = {
		name: QuizToolName.CoreConfirmationToolWithOptions,
		description: 'Ask the user to choose from a list of options. Returns the selected option.',
		inputSchema: {
			type: 'object',
			required: ['message', 'options'],
			properties: {
				message: {
					description: 'The message to display to the user.',
					type: 'string',
				},
				options: {
					description: 'The list of options for the user to choose from.',
					type: 'array',
					items: { type: 'string' },
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizConfirmationWithOptionsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Choice for "${parameters.message}" from options ${JSON.stringify(parameters.options)} would be requested here via IDialogService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get choice: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizConfirmationWithOptionsTool());

// #endregion

// #region AskQuestionsTool (aligned with Copilot's AskQuestionsTool)

export interface IQuizAskQuestionsInput {
	questions: readonly {
		question: string;
		options?: readonly string[];
	}[];
}

export class QuizAskQuestionsTool extends QuizBuiltinTool<IQuizAskQuestionsInput> {

	readonly toolName = QuizToolName.CoreAskQuestions;

	readonly definition = {
		name: QuizToolName.CoreAskQuestions,
		description: 'Ask the user one or more questions. Returns the user\'s answers. Use this when you need clarification or additional information from the user.',
		inputSchema: {
			type: 'object',
			required: ['questions'],
			properties: {
				questions: {
					description: 'Array of questions to ask the user.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							question: {
								description: 'The question text.',
								type: 'string',
							},
							options: {
								description: 'Optional predefined answer options.',
								type: 'array',
								items: { type: 'string' },
							},
						},
						required: ['question'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizAskQuestionsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const questions = parameters.questions.map(q => q.question).join('; ');
			return quizToolResultText(`[Answers for questions: "${questions}" would be collected here via IChatService]`);
		} catch (err) {
			return quizToolResultError(`Failed to ask questions: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizAskQuestionsTool());

// #endregion

// #region ReviewPlanTool (aligned with Copilot's ReviewPlanTool)

export interface IQuizReviewPlanInput {
	plan: string;
}

export class QuizReviewPlanTool extends QuizBuiltinTool<IQuizReviewPlanInput> {

	readonly toolName = QuizToolName.CoreReviewPlan;

	readonly definition = {
		name: QuizToolName.CoreReviewPlan,
		description: 'Present a plan to the user for review before executing it. The user can approve, modify, or reject the plan.',
		inputSchema: {
			type: 'object',
			required: ['plan'],
			properties: {
				plan: {
					description: 'The plan text to present for review.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizReviewPlanInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Plan review for: "${parameters.plan.substring(0, 200)}..." would be presented here via IDialogService]`);
		} catch (err) {
			return quizToolResultError(`Failed to review plan: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizReviewPlanTool());

// #endregion

// #region SwitchAgentTool (aligned with Copilot's SwitchAgentTool)

export interface IQuizSwitchAgentInput {
	agentName: string;
}

export class QuizSwitchAgentTool extends QuizBuiltinTool<IQuizSwitchAgentInput> {

	readonly toolName = QuizToolName.SwitchAgent;

	readonly definition = {
		name: QuizToolName.SwitchAgent,
		description: 'Switch to a different agent mode (e.g., from "agent" to "edit" mode). Use this when the current mode is not suitable for the task.',
		inputSchema: {
			type: 'object',
			required: ['agentName'],
			properties: {
				agentName: {
					description: 'The name of the agent mode to switch to.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizSwitchAgentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Switch to agent "${parameters.agentName}" would be handled here via IChatAgentService]`);
		} catch (err) {
			return quizToolResultError(`Failed to switch agent: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizSwitchAgentTool());

// #endregion

// #region ToolSearchTool (aligned with Copilot's ToolSearchTool)

export interface IQuizToolSearchInput {
	query: string;
}

export class QuizToolSearchTool extends QuizBuiltinTool<IQuizToolSearchInput> {

	readonly toolName = QuizToolName.ToolSearch;

	readonly definition = {
		name: QuizToolName.ToolSearch,
		description: 'Search for available tools by name or description. Use this to discover tools that are available but not currently visible in the tool list.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The search query to find tools by name or description.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizToolSearchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Tool search results for "${parameters.query}" would be provided here via IQuizToolsService]`);
		} catch (err) {
			return quizToolResultError(`Failed to search tools: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizToolSearchTool());

// #endregion

// #region VSCodeAPITool (aligned with Copilot's VSCodeAPITool)

export interface IQuizVSCodeAPIInput {
	query: string;
}

export class QuizVSCodeAPITool extends QuizBuiltinTool<IQuizVSCodeAPIInput> {

	readonly toolName = QuizToolName.VSCodeAPI;

	readonly definition = {
		name: QuizToolName.VSCodeAPI,
		description: 'Search for VS Code API documentation. Returns relevant API references, types, and usage examples.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The API search query (e.g., "TextDocument.lineAt").',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizVSCodeAPIInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[VS Code API docs for "${parameters.query}" would be retrieved here]`);
		} catch (err) {
			return quizToolResultError(`Failed to get VS Code API: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizVSCodeAPITool());

// #endregion
