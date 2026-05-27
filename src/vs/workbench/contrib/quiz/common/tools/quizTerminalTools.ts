/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region RunInTerminalTool (aligned with Copilot's RunInTerminalTool)

export interface IQuizRunInTerminalInput {
	command: string;
	cwd?: string;
	waitForOutput?: boolean;
	timeout?: number;
}

export class QuizRunInTerminalTool extends QuizBuiltinTool<IQuizRunInTerminalInput> {

	readonly toolName = QuizToolName.CoreRunInTerminal;

	readonly definition = {
		name: QuizToolName.CoreRunInTerminal,
		description: 'Run a command in the terminal. Returns the command output if waitForOutput is true. Long-running commands will be moved to the background after a timeout.',
		inputSchema: {
			type: 'object',
			required: ['command'],
			properties: {
				command: {
					description: 'The command to run in the terminal.',
					type: 'string',
				},
				cwd: {
					description: 'The working directory for the command. Defaults to the workspace root.',
					type: 'string',
				},
				waitForOutput: {
					description: 'Whether to wait for the command to produce output before returning. Default: true.',
					type: 'boolean',
				},
				timeout: {
					description: 'Maximum time in milliseconds to wait for the command to complete. Default: 30000.',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizRunInTerminalInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Terminal command "${parameters.command}" would be executed here via ITerminalService]`);
		} catch (err) {
			return quizToolResultError(`Failed to run terminal command: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizRunInTerminalInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Run terminal command?',
				message: `The AI wants to run: \`${parameters.command}\``,
			},
			invocationMessage: `Running: ${parameters.command}`,
		};
	}
}

QuizBuiltinToolRegistry.register(new QuizRunInTerminalTool());

// #endregion

// #region GetTerminalOutputTool (aligned with Copilot's GetTerminalOutputTool)

export interface IQuizGetTerminalOutputInput {
	terminalId: string;
	timeout?: number;
}

export class QuizGetTerminalOutputTool extends QuizBuiltinTool<IQuizGetTerminalOutputInput> {

	readonly toolName = QuizToolName.CoreGetTerminalOutput;

	readonly definition = {
		name: QuizToolName.CoreGetTerminalOutput,
		description: 'Get the output from a terminal that was previously started. Use this to check the status of long-running commands.',
		inputSchema: {
			type: 'object',
			required: ['terminalId'],
			properties: {
				terminalId: {
					description: 'The ID of the terminal to get output from.',
					type: 'string',
				},
				timeout: {
					description: 'Maximum time in milliseconds to wait for new output. Default: 5000.',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGetTerminalOutputInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Terminal output for ${parameters.terminalId} would be retrieved here via ITerminalService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get terminal output: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizGetTerminalOutputTool());

// #endregion

// #region SendToTerminalTool (aligned with Copilot's SendToTerminalTool)

export interface IQuizSendToTerminalInput {
	terminalId: string;
	text: string;
}

export class QuizSendToTerminalTool extends QuizBuiltinTool<IQuizSendToTerminalInput> {

	readonly toolName = QuizToolName.CoreSendToTerminal;

	readonly definition = {
		name: QuizToolName.CoreSendToTerminal,
		description: 'Send text input to a running terminal. Use this to respond to prompts or provide input to interactive commands.',
		inputSchema: {
			type: 'object',
			required: ['terminalId', 'text'],
			properties: {
				terminalId: {
					description: 'The ID of the terminal to send input to.',
					type: 'string',
				},
				text: {
					description: 'The text to send to the terminal.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizSendToTerminalInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Text sent to terminal ${parameters.terminalId}]`);
		} catch (err) {
			return quizToolResultError(`Failed to send to terminal: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizSendToTerminalTool());

// #endregion

// #region KillTerminalTool (aligned with Copilot's KillTerminalTool)

export interface IQuizKillTerminalInput {
	terminalId: string;
}

export class QuizKillTerminalTool extends QuizBuiltinTool<IQuizKillTerminalInput> {

	readonly toolName = QuizToolName.CoreKillTerminal;

	readonly definition = {
		name: QuizToolName.CoreKillTerminal,
		description: 'Kill a running terminal process. Use this to stop long-running or stuck commands.',
		inputSchema: {
			type: 'object',
			required: ['terminalId'],
			properties: {
				terminalId: {
					description: 'The ID of the terminal to kill.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizKillTerminalInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Terminal ${parameters.terminalId} would be killed here via ITerminalService]`);
		} catch (err) {
			return quizToolResultError(`Failed to kill terminal: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizKillTerminalInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: 'Kill terminal?',
				message: `The AI wants to kill terminal ${parameters.terminalId}`,
			},
			invocationMessage: `Killing terminal ${parameters.terminalId}`,
		};
	}
}

QuizBuiltinToolRegistry.register(new QuizKillTerminalTool());

// #endregion

// #region TerminalSelectionTool (aligned with Copilot's TerminalSelectionTool)

export interface IQuizTerminalSelectionInput {
	terminalId?: string;
}

export class QuizTerminalSelectionTool extends QuizBuiltinTool<IQuizTerminalSelectionInput> {

	readonly toolName = QuizToolName.CoreTerminalSelection;

	readonly definition = {
		name: QuizToolName.CoreTerminalSelection,
		description: 'Get the current selected text in the terminal, or the full visible buffer if no selection exists.',
		inputSchema: {
			type: 'object',
			properties: {
				terminalId: {
					description: 'Optional terminal ID. If not specified, uses the active terminal.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizTerminalSelectionInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Terminal selection for ${parameters.terminalId ?? 'active terminal'} would be retrieved here via ITerminalService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get terminal selection: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizTerminalSelectionTool());

// #endregion

// #region TerminalLastCommandTool (aligned with Copilot's TerminalLastCommandTool)

export interface IQuizTerminalLastCommandInput {
	terminalId?: string;
}

export class QuizTerminalLastCommandTool extends QuizBuiltinTool<IQuizTerminalLastCommandInput> {

	readonly toolName = QuizToolName.CoreTerminalLastCommand;

	readonly definition = {
		name: QuizToolName.CoreTerminalLastCommand,
		description: 'Get the last command that was run in the terminal and its output.',
		inputSchema: {
			type: 'object',
			properties: {
				terminalId: {
					description: 'Optional terminal ID. If not specified, uses the active terminal.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizTerminalLastCommandInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Last command output for ${parameters.terminalId ?? 'active terminal'} would be retrieved here via ITerminalService]`);
		} catch (err) {
			return quizToolResultError(`Failed to get last terminal command: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizTerminalLastCommandTool());

// #endregion
