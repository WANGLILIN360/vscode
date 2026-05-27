/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer VS Code interaction tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's vscodeCmdTool.tsx, manageTodoListTool.tsx, etc.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext, IQuizToolsService } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { ICommandService, CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IChatService, IChatQuestion, IChatQuestionAnswers, IChatSingleSelectAnswer, IChatMultiSelectAnswer } from '../../../chat/common/chatService/chatService.js';
import { IChatTodoListService, IChatTodo } from '../../../chat/common/tools/chatTodoListService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ChatQuestionCarouselData } from '../../../chat/common/model/chatProgressTypes/chatQuestionCarouselData.js';
import { ChatPlanReviewData } from '../../../chat/common/model/chatProgressTypes/chatPlanReviewData.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { raceCancellation } from '../../../../../base/common/async.js';
import { CancellationError } from '../../../../../base/common/errors.js';


// #region QuizRunVscodeCommandToolImpl (browser-layer, aligned with Copilot's VSCodeCmdTool)

/** Commands that are read-only / have no side effects and can run without user confirmation.
 * Aligned with Copilot's vscodeCmdTool.tsx noConfirmationCommandsWithoutArgs. */
const noConfirmationCommandsWithoutArgs = new Set([
	'breadcrumbs.toggle',
	'diffEditor.toggleCollapseUnchangedRegions',
	'diffEditor.toggleShowMovedCodeBlocks',
	'editor.action.announceCursorPosition',
	'editor.action.defineKeybinding',
	'editor.action.showOrFocusStandaloneColorPicker',
	'editor.action.toggleOvertypeInsertMode',
	'editor.action.toggleScreenReaderAccessibilityMode',
	'editor.action.toggleStickyScroll',
	'extension.bisect.start',
	'extension.bisect.stop',
	'git.blame.toggleEditorDecoration',
	'git.branch',
	'git.closeAllDiffEditors',
	'git.closeAllUnmodifiedEditors',
	'git.openAllChanges',
	'git.rebaseAbort',
	'git.showOutput',
	'git.stageAll',
	'git.stash',
	'git.stashPop',
	'git.stashPopLatest',
	'git.stashStaged',
	'git.stashView',
	'markdown.showPreview',
	'markdown.showSource',
	'search.action.getSearchResults',
	'update.checkForUpdate',
	'update.downloadUpdate',
	'update.installUpdate',
	'update.restartToUpdate',
	'workbench.action.activityBarLocation.bottom',
	'workbench.action.activityBarLocation.default',
	'workbench.action.activityBarLocation.hide',
	'workbench.action.activityBarLocation.top',
	'workbench.action.chat.export',
	'workbench.action.chat.openFeatureSettings',
	'workbench.action.chat.openInEditor',
	'workbench.action.chat.openInNewWindow',
	'workbench.action.chat.openInSidebar',
	'workbench.action.chat.readChatResponseAloud',
	'workbench.action.chatEditor.newChat',
	'workbench.action.closeAuxiliaryBar',
	'workbench.action.closePanel',
	'workbench.action.closeSidebar',
	'workbench.action.configureRuntimeArguments',
	'workbench.action.newWindow',
	'workbench.action.openFolderSettings',
	'workbench.action.openGlobalSettings',
	'workbench.action.openLogFile',
	'workbench.action.openSnippets',
	'workbench.action.openWorkspaceSettings',
	'workbench.action.showAboutDialog',
	'workbench.action.showRuntimeExtensions',
	'workbench.action.toggleFullScreen',
	'workbench.action.toggleZenMode',
	'workbench.action.zoomIn',
	'workbench.action.zoomOut',
	'workbench.action.zoomReset',
]);

/** Commands that can run without confirmation even with arguments.
 * Aligned with Copilot's vscodeCmdTool.tsx noConfirmationCommandsWithArgs. */
const noConfirmationCommandsWithArgs = new Set([
	'editor.action.goToReferences',
	'editor.action.peekDeclaration',
	'editor.action.referenceSearch.trigger',
	'editor.showCallHierarchy',
	'editor.showIncomingCalls',
	'editor.showOutgoingCalls',
	'editor.showSubtypes',
	'editor.showSupertypes',
	'editor.showTypeHierarchy',
	'extension.bisect.next',
	'git.openChange',
	'git.openMergeEditor',
	'git.stage',
]);

export interface IQuizRunVscodeCommandInput {
	commandId: string;
	args?: unknown[];
}

export class QuizRunVscodeCommandToolImpl extends QuizBuiltinTool<IQuizRunVscodeCommandInput> {

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

	constructor(
		private readonly _commandService: ICommandService,
	) {
		super();
	}

	override async invoke(parameters: IQuizRunVscodeCommandInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Aligned with Copilot's VSCodeCmdTool.invoke:
			// Validate command exists before executing
			const allCommands = CommandsRegistry.getCommands();
			if (!allCommands.has(parameters.commandId)) {
				return quizToolResultError(`Failed to find command \`${parameters.commandId}\`.`);
			}

			const result = await this._commandService.executeCommand(
				parameters.commandId,
				...(parameters.args ?? []),
			);

			// Aligned with Copilot's result formatting
			if (result === undefined || result === null) {
				return quizToolResultText(`Finished running command \`${parameters.commandId}\`.`);
			}

			if (typeof result === 'string') {
				return quizToolResultText(`Finished running command \`${parameters.commandId}\` with result:\n\n${result}`);
			}

			let serializedResult: string;
			try {
				serializedResult = JSON.stringify(result);
			} catch {
				serializedResult = String(result);
			}
			return quizToolResultText(`Finished running command \`${parameters.commandId}\` with result:\n\n${serializedResult}`);
		} catch (err) {
			return quizToolResultError(`Failed to run VS Code command "${parameters.commandId}": ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizRunVscodeCommandInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		const commandId = parameters.commandId;
		if (!commandId) {
			throw new Error('Command ID undefined');
		}

		const invocationMessage = `Running command \`${commandId}\``;

		// Aligned with Copilot's allowlist: skip confirmation for safe commands
		const hasArgs = !!parameters.args?.length;
		if (noConfirmationCommandsWithoutArgs.has(commandId) && !hasArgs) {
			return { invocationMessage };
		}
		if (noConfirmationCommandsWithArgs.has(commandId)) {
			return { invocationMessage };
		}

		// All other commands require confirmation — aligned with Copilot's confirmation pattern
		const hasArguments = !!parameters.args?.length;
		let message = `Copilot will execute the \`${commandId}\` command.`;
		if (hasArguments) {
			message += `\n\nArguments:\n\n\`\`\`json\n${JSON.stringify(parameters.args, undefined, 2)}\n\`\`\``;
		}

		return {
			confirmationMessages: {
				title: `Run Command \`${commandId}\`?`,
				message,
			},
			invocationMessage,
		};
	}
}

// #endregion

// #region QuizManageTodoListToolImpl (browser-layer, aligned with Copilot's ManageTodoListTool)

export interface IQuizManageTodoListInput {
	operation?: 'write' | 'read';
	todoList: readonly {
		id: number;
		title: string;
		status: 'not-started' | 'in-progress' | 'completed';
	}[];
	chatSessionResource?: string;
}

export class QuizManageTodoListToolImpl extends QuizBuiltinTool<IQuizManageTodoListInput> {

	readonly toolName = QuizToolName.CoreManageTodoList;

	readonly definition = {
		name: QuizToolName.CoreManageTodoList,
		description: 'Manage a structured todo list to track progress and plan tasks throughout your coding session. Use this tool VERY frequently to ensure task visibility and proper planning.\n\nWhen to use this tool:\n- Complex multi-step work requiring planning and tracking\n- When user provides multiple tasks or requests\n- After receiving new instructions that require multiple steps\n- BEFORE starting work on any todo (mark as in-progress)\n- IMMEDIATELY after completing each todo (mark completed individually)\n\nTodo states:\n- not-started: Todo not yet begun\n- in-progress: Currently working (limit ONE at a time)\n- completed: Finished successfully',
		inputSchema: {
			type: 'object',
			required: ['todoList'],
			properties: {
				todoList: {
					description: 'Complete array of all todo items. Must include ALL items - both existing and new.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: {
								type: 'number',
								description: 'Unique identifier for the todo. Use sequential numbers starting from 1.'
							},
							title: {
								type: 'string',
								description: 'Concise action-oriented todo label (3-7 words). Displayed in UI.'
							},
							status: {
								type: 'string',
								enum: ['not-started', 'in-progress', 'completed'],
								description: 'not-started: Not begun | in-progress: Currently working (max 1) | completed: Fully finished with no blockers'
							},
						},
						required: ['id', 'title', 'status']
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _chatTodoListService: IChatTodoListService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async invoke(parameters: IQuizManageTodoListInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		let chatSessionResource = context.sessionResource;
		if (!chatSessionResource && parameters.operation === 'read' && parameters.chatSessionResource) {
			try {
				chatSessionResource = URI.parse(parameters.chatSessionResource);
			} catch (error) {
				this._logService.error('QuizManageTodoListTool: Invalid chatSessionResource URI', error);
			}
		}
		if (!chatSessionResource) {
			return quizToolResultError('No session resource available');
		}

		try {
			if (parameters.operation === 'read') {
				return this._handleRead(chatSessionResource);
			} else {
				return this._handleWrite(parameters, chatSessionResource);
			}
		} catch (error) {
			const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			return quizToolResultError(errorMessage);
		}
	}

	private _handleRead(chatSessionResource: URI): IQuizToolResult {
		const todoItems = this._chatTodoListService.getTodos(chatSessionResource);
		if (todoItems.length === 0) {
			return quizToolResultText('No todo list found.');
		}
		const markdownTaskList = this._formatTodoListAsMarkdownTaskList(todoItems);
		return quizToolResultText(`# Todo List\n\n${markdownTaskList}`);
	}

	private _handleWrite(parameters: IQuizManageTodoListInput, chatSessionResource: URI): IQuizToolResult {
		if (!parameters.todoList) {
			return quizToolResultError('todoList is required for write operation');
		}

		const todoList: IChatTodo[] = parameters.todoList.map(parsedTodo => ({
			id: parsedTodo.id,
			title: parsedTodo.title,
			status: parsedTodo.status,
		}));

		const existingTodos = this._chatTodoListService.getTodos(chatSessionResource);
		const changes = this._calculateTodoChanges(existingTodos, todoList);

		// Generate past-tense message (aligned with Copilot's generatePastTenseMessage)
		const pastTenseMessage = this._generatePastTenseMessage(existingTodos, todoList);

		this._chatTodoListService.setTodos(chatSessionResource, todoList);

		// Build warnings (aligned with Copilot)
		const warnings: string[] = [];
		if (todoList.length < 3) {
			warnings.push('Warning: Small todo list (<3 items). This task might not need a todo list.');
		} else if (todoList.length > 10) {
			warnings.push('Warning: Large todo list (>10 items). Consider keeping the list focused and actionable.');
		}
		if (changes > 3) {
			warnings.push('Warning: Did you mean to update so many todos at the same time? Consider working on them one by one.');
		}

		return quizToolResultText(`${pastTenseMessage}${warnings.length ? '\n\n' + warnings.join('\n') : ''}`);
	}

	/**
	 * Generate a past-tense message describing what changed in the todo list.
	 * Aligned with Copilot's ManageTodoListTool.generatePastTenseMessage().
	 * Priorities: started > completed > added > generic update.
	 */
	private _generatePastTenseMessage(currentTodos: IChatTodo[], newTodos: readonly { id: number; title: string; status: string }[]): string {
		// Empty → with items: report creation
		if (currentTodos.length === 0 && newTodos.length > 0) {
			return newTodos.length === 1
				? 'Created 1 todo'
				: `Created ${newTodos.length} todos`;
		}

		const currentTodoMap = new Map(currentTodos.map(todo => [todo.id, todo]));

		// Check for in-progress transitions (highest priority)
		const startedTodos = newTodos.filter(newTodo => {
			const currentTodo = currentTodoMap.get(newTodo.id);
			return currentTodo && currentTodo.status !== 'in-progress' && newTodo.status === 'in-progress';
		});

		if (startedTodos.length > 0) {
			const startedTodo = startedTodos[0];
			const totalTodos = newTodos.length;
			const currentPosition = newTodos.findIndex(todo => todo.id === startedTodo.id) + 1;
			return `Starting: *${startedTodo.title}* (${currentPosition}/${totalTodos})`;
		}

		// Check for completed transitions
		const completedTodos = newTodos.filter(newTodo => {
			const currentTodo = currentTodoMap.get(newTodo.id);
			return currentTodo && currentTodo.status !== 'completed' && newTodo.status === 'completed';
		});

		if (completedTodos.length > 0) {
			const completedTodo = completedTodos[0];
			const totalTodos = newTodos.length;
			const currentPosition = newTodos.findIndex(todo => todo.id === completedTodo.id) + 1;
			return `Completed: *${completedTodo.title}* (${currentPosition}/${totalTodos})`;
		}

		// Check for added todos
		const addedTodos = newTodos.filter(newTodo => !currentTodoMap.has(newTodo.id));
		if (addedTodos.length > 0) {
			return addedTodos.length === 1
				? 'Added 1 todo'
				: `Added ${addedTodos.length} todos`;
		}

		return 'Updated todo list';
	}

	private _formatTodoListAsMarkdownTaskList(todoList: IChatTodo[]): string {
		if (todoList.length === 0) {
			return '';
		}
		return todoList.map(todo => {
			let checkbox: string;
			switch (todo.status) {
				case 'completed': checkbox = '[x]'; break;
				case 'in-progress': checkbox = '[-]'; break;
				case 'not-started': default: checkbox = '[ ]'; break;
			}
			return `- ${checkbox} ${todo.title}`;
		}).join('\n');
	}

	private _calculateTodoChanges(oldList: IChatTodo[], newList: IChatTodo[]): number {
		let modified = 0;
		const minLen = Math.min(oldList.length, newList.length);
		for (let i = 0; i < minLen; i++) {
			const o = oldList[i];
			const n = newList[i];
			if (o.title !== n.title || o.status !== n.status) {
				modified++;
			}
		}
		const added = Math.max(0, newList.length - oldList.length);
		const removed = Math.max(0, oldList.length - newList.length);
		return added + removed + modified;
	}
}

// #endregion

// #region QuizConfirmationToolImpl (browser-layer, aligned with Copilot's ConfirmationTool)

export interface IQuizConfirmationInput {
	title: string;
	message: string;
	confirmationType?: 'basic' | 'terminal';
	terminalCommand?: string;
	buttons?: readonly string[];
}

export class QuizConfirmationToolImpl extends QuizBuiltinTool<IQuizConfirmationInput> {

	readonly toolName = QuizToolName.CoreConfirmationTool;

	readonly definition = {
		name: QuizToolName.CoreConfirmationTool,
		description: 'Ask the user for confirmation before proceeding with an action. Returns "yes" if confirmed, or the label of a custom button if one was selected.',
		inputSchema: {
			type: 'object',
			required: ['title', 'message'],
			properties: {
				title: {
					description: 'Title of the confirmation dialog.',
					type: 'string',
				},
				message: {
					description: 'The message to display to the user for confirmation.',
					type: 'string',
				},
				confirmationType: {
					description: 'Type of confirmation: "basic" for simple confirm/cancel, "terminal" for terminal command confirmation.',
					type: 'string',
					enum: ['basic', 'terminal'],
				},
				terminalCommand: {
					description: 'The terminal command to display when confirmationType is "terminal".',
					type: 'string',
				},
				buttons: {
					description: 'Custom button labels. The first button is the approve action, others are deny actions.',
					type: 'array',
					items: { type: 'string' },
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor() {
		super();
	}

	override async prepareInvocation(parameters: IQuizConfirmationInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: parameters.title,
				message: parameters.message,
			},
			invocationMessage: parameters.confirmationType === 'terminal'
				? `Confirming terminal command: ${parameters.terminalCommand ?? ''}`
				: `Confirming: ${parameters.title}`,
		};
	}

	override async invoke(parameters: IQuizConfirmationInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		// NOTE: Confirmation tools are handled by Copilot's ConfirmationTool via
		// ILanguageModelToolsService, which provides the full confirmation UI flow.
		// For terminal-type confirmations, Copilot passes IChatTerminalToolInvocationData
		// as toolSpecificData in prepareToolInvocation, which renders the terminal command
		// in the chat confirmation UI. The Quiz tool calling loop delegates to
		// ILanguageModelToolsService.invokeTool, so Copilot's implementation handles
		// prepareToolInvocation (with toolSpecificData for terminal type) and confirmation rendering.
		// This IQuizCopilotTool.invoke is only reached if Quiz tool routing is changed.

		// If called directly (e.g., in a future Quiz-specific tool routing path),
		// return the default confirmation result aligned with Copilot's behavior:
		// - Custom buttons: return the first (approve) button label
		// - Basic confirmation: return 'yes' (standard Allow confirmation)
		if (parameters.buttons && parameters.buttons.length > 0) {
			return quizToolResultText(parameters.buttons[0]);
		}
		return quizToolResultText('yes');
	}
}

// #endregion

// #region QuizConfirmationWithOptionsToolImpl (browser-layer, aligned with Copilot's ConfirmationToolWithOptions)
// Copilot registers the same ConfirmationTool class under a different IToolData (ConfirmationToolWithOptionsData).
// This tool requires custom buttons and does not allow auto-confirm.

export interface IQuizConfirmationWithOptionsInput {
	title: string;
	message: string;
	options: readonly string[];
}

export class QuizConfirmationWithOptionsToolImpl extends QuizBuiltinTool<IQuizConfirmationWithOptionsInput> {

	readonly toolName = QuizToolName.CoreConfirmationToolWithOptions;

	readonly definition = {
		name: QuizToolName.CoreConfirmationToolWithOptions,
		description: 'Ask the user to choose from a list of custom options. Returns the selected option label. Auto-confirm is not allowed when custom options are provided.',
		inputSchema: {
			type: 'object',
			required: ['title', 'message', 'options'],
			properties: {
				title: {
					description: 'Title of the confirmation dialog.',
					type: 'string',
				},
				message: {
					description: 'The message to display to the user.',
					type: 'string',
				},
				options: {
					description: 'The list of options for the user to choose from. The first option is the approve action, others are deny actions.',
					type: 'array',
					items: { type: 'string' },
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor() {
		super();
	}

	override async prepareInvocation(parameters: IQuizConfirmationWithOptionsInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: parameters.title,
				message: parameters.message,
			},
			invocationMessage: `Asking for choice: ${parameters.title}`,
		};
	}

	override async invoke(parameters: IQuizConfirmationWithOptionsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		// NOTE: Like ConfirmationTool, this is handled by Copilot's ConfirmationTool
		// via ILanguageModelToolsService, which provides the full confirmation UI flow
		// with customOptions (ConfirmationOptionKind). The Quiz tool calling loop
		// delegates to ILanguageModelToolsService.invokeTool, so Copilot's implementation
		// handles prepareToolInvocation (with customOptions mapped from the options array)
		// and confirmation rendering.

		// If called directly, return the first (approve) option label aligned with Copilot.
		return quizToolResultText(parameters.options[0]);
	}
}

// #endregion

// #region QuizModifiedFilesConfirmationToolImpl (browser-layer, aligned with Copilot's ModifiedFilesConfirmationTool)

export interface IQuizModifiedFilesConfirmationInput {
	title: string;
	message: string;
	options: readonly string[];
	modifiedFiles: readonly {
		uri: string;
		originalUri?: string;
		insertions?: number;
		deletions?: number;
		title?: string;
		description?: string;
	}[];
}

export class QuizModifiedFilesConfirmationToolImpl extends QuizBuiltinTool<IQuizModifiedFilesConfirmationInput> {

	readonly toolName = QuizToolName.ModifiedFilesConfirmation;

	readonly definition = {
		name: QuizToolName.ModifiedFilesConfirmation,
		description: 'Show a modified-files confirmation UI with a split primary button and a hardcoded cancel action. The first option is the approve action, remaining options are placed in the dropdown menu.',
		inputSchema: {
			type: 'object',
			required: ['title', 'message', 'options', 'modifiedFiles'],
			properties: {
				title: {
					description: 'Title for the confirmation dialog.',
					type: 'string',
				},
				message: {
					description: 'Message to show in the confirmation dialog.',
					type: 'string',
				},
				options: {
					description: 'Selectable option labels. The first option is used for the primary split button and the remaining options are placed in the dropdown menu.',
					type: 'array',
					items: { type: 'string' },
					minItems: 1,
				},
				modifiedFiles: {
					description: 'Modified files to show in the confirmation UI.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							uri: {
								description: 'URI of the modified file.',
								type: 'string',
							},
							originalUri: {
								description: 'Optional original URI used when opening a diff.',
								type: 'string',
							},
							insertions: {
								description: 'Optional number of lines added.',
								type: 'number',
							},
							deletions: {
								description: 'Optional number of lines removed.',
								type: 'number',
							},
							title: {
								description: 'Optional title shown in the file tooltip.',
								type: 'string',
							},
							description: {
								description: 'Optional secondary label shown for the file entry.',
								type: 'string',
							},
						},
						required: ['uri'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor() {
		super();
	}

	override async prepareInvocation(parameters: IQuizModifiedFilesConfirmationInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		if (!parameters.title || !parameters.message) {
			throw new Error('Missing required parameters for ModifiedFilesConfirmationTool');
		}
		if (!parameters.options?.length) {
			throw new Error('ModifiedFilesConfirmationTool requires at least one option');
		}

		return {
			confirmationMessages: {
				title: parameters.title,
				message: parameters.message,
			},
			invocationMessage: parameters.title,
		};
	}

	override async invoke(parameters: IQuizModifiedFilesConfirmationInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		// NOTE: This tool is handled by Copilot's ModifiedFilesConfirmationTool via
		// ILanguageModelToolsService, which provides the full confirmation UI flow
		// (toolSpecificData: IChatModifiedFilesConfirmationData). The Quiz tool calling
		// loop delegates to ILanguageModelToolsService.invokeTool, so Copilot's
		// implementation handles prepareToolInvocation (with toolSpecificData) and the
		// confirmation rendering. This IQuizCopilotTool.invoke is only reached if the
		// Quiz tool routing is changed to prefer IQuizCopilotTool over ILanguageModelToolsService.

		// If called directly (e.g., in a future Quiz-specific tool routing path),
		// fall back to a simple confirmation approach.
		// Aligned with Copilot: the first option is the approve action, remaining are deny.
		const primaryOption = parameters.options[0];

		// Return the primary (approve) option as the default result
		// In the Copilot flow, the chat confirmation UI handles user interaction and
		// passes selectedCustomButton through IToolInvocation.selectedCustomButton.
		return quizToolResultText(primaryOption);
	}
}

// #endregion

// #region QuizAskQuestionsToolImpl (browser-layer, aligned with Copilot's AskQuestionsTool)

export interface IQuizQuestion {
	question: string;
	header: string;
	type: 'singleSelect' | 'multiSelect' | 'text';
	options?: readonly {
		label: string;
		description?: string;
		recommended?: boolean;
	}[];
	allowFreeformInput?: boolean;
}

export interface IQuizAskQuestionsInput {
	questions: readonly IQuizQuestion[];
}

export class QuizAskQuestionsToolImpl extends QuizBuiltinTool<IQuizAskQuestionsInput> {

	readonly toolName = QuizToolName.CoreAskQuestions;

	readonly definition = {
		name: QuizToolName.CoreAskQuestions,
		description: 'Ask the user one or more structured questions. Supports single-select, multi-select, and freeform text input. Returns structured answers as JSON.',
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
							header: {
								description: 'Short header for the question (used as key in the answers object).',
								type: 'string',
							},
							type: {
								description: 'Question type: singleSelect (pick one), multiSelect (pick many), or text (freeform).',
								type: 'string',
								enum: ['singleSelect', 'multiSelect', 'text'],
							},
							options: {
								description: 'Available options for singleSelect/multiSelect questions.',
								type: 'array',
								items: {
									type: 'object',
									properties: {
										label: { type: 'string', description: 'Option label' },
										description: { type: 'string', description: 'Optional detail shown below the label' },
										recommended: { type: 'boolean', description: 'Whether this option is recommended' },
									},
									required: ['label'],
								},
							},
							allowFreeformInput: {
								description: 'Whether the user can provide a freeform text answer in addition to selecting options.',
								type: 'boolean',
							},
						},
						required: ['question', 'header', 'type'],
					},
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _chatService: IChatService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async invoke(parameters: IQuizAskQuestionsInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		if (!parameters.questions || parameters.questions.length === 0) {
			return quizToolResultError('No questions provided. The questions array must contain at least one question.');
		}

		const chatSessionResource = context.sessionResource;
		if (!chatSessionResource) {
			this._logService.warn('[QuizAskQuestionsTool] Missing chat context; marking all questions as skipped.');
			return quizToolResultText(JSON.stringify(this._createSkippedResult(parameters.questions)));
		}

		try {
			// Convert Quiz questions to IChatQuestion format (aligned with Copilot's toQuestionCarousel)
			const resolveId = context.toolCallId;
			const chatQuestions: IChatQuestion[] = parameters.questions.map(q => ({
				id: q.header ?? generateUuid(),
				type: q.type as 'singleSelect' | 'multiSelect' | 'text',
				title: q.question,
				options: q.options?.map(o => ({
					id: o.label,
					label: o.label,
					value: o.label,
				})),
				allowFreeformInput: q.allowFreeformInput,
			}));

			const carousel = new ChatQuestionCarouselData(
				chatQuestions,
				true, // allowSkip
				resolveId,
			);

			// Append the carousel to the chat progress (aligned with Copilot's chatService.appendProgress)
			const model = this._chatService.getSession(chatSessionResource);
			if (!model) {
				return quizToolResultText(JSON.stringify(this._createSkippedResult(parameters.questions)));
			}
			const request = model.getRequests().at(-1);
			if (!request) {
				return quizToolResultText(JSON.stringify(this._createSkippedResult(parameters.questions)));
			}
			this._chatService.appendProgress(request, carousel);

			// Wait for the user to answer (aligned with Copilot's raceCancellation pattern)
			let answerResult: { answers: IChatQuestionAnswers | undefined } | undefined;
			try {
				answerResult = await raceCancellation(carousel.completion.p, token);
			} catch (error) {
				if (error instanceof CancellationError) {
					carousel.dismiss(undefined);
				}
				throw error;
			}

			if (!answerResult) {
				carousel.dismiss(undefined);
				throw new CancellationError();
			}
			if (token.isCancellationRequested) {
				throw new CancellationError();
			}

			// Convert carousel answers to structured result (aligned with Copilot's convertCarouselAnswers)
			const converted = this._convertAnswers(parameters.questions, answerResult?.answers);
			return quizToolResultText(JSON.stringify(converted));
		} catch (error) {
			if (error instanceof CancellationError) {
				throw error;
			}
			return quizToolResultError(`Failed to ask questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	private _createSkippedResult(questions: readonly IQuizQuestion[]): Record<string, { skipped: boolean }> {
		const result: Record<string, { skipped: boolean }> = {};
		for (const q of questions) {
			result[q.header] = { skipped: true };
		}
		return result;
	}

	private _convertAnswers(
		questions: readonly IQuizQuestion[],
		answers: IChatQuestionAnswers | undefined,
	): Record<string, { selected?: string | string[]; freeText?: string; skipped?: boolean }> {
		const result: Record<string, { selected?: string | string[]; freeText?: string; skipped?: boolean }> = {};
		for (const q of questions) {
			const answer = answers?.[q.header];
			if (!answer) {
				result[q.header] = { skipped: true };
			} else if (typeof answer === 'string') {
				result[q.header] = { freeText: answer };
			} else if (Array.isArray((answer as IChatMultiSelectAnswer).selectedValues)) {
				const multi = answer as IChatMultiSelectAnswer;
				result[q.header] = { selected: multi.selectedValues, freeText: multi.freeformValue };
			} else {
				const single = answer as IChatSingleSelectAnswer;
				result[q.header] = { selected: single.selectedValue, freeText: single.freeformValue };
			}
		}
		return result;
	}
}

// #endregion

// #region QuizReviewPlanToolImpl (browser-layer, aligned with Copilot's ReviewPlanTool)

export interface IQuizPlanApprovalAction {
	label: string;
	description?: string;
	default?: boolean;
	permissionLevel?: 'autopilot';
}

export interface IQuizReviewPlanInput {
	title?: string;
	plan?: string;
	content: string;
	actions: readonly IQuizPlanApprovalAction[];
	canProvideFeedback: boolean;
}

export class QuizReviewPlanToolImpl extends QuizBuiltinTool<IQuizReviewPlanInput> {

	readonly toolName = QuizToolName.CoreReviewPlan;

	readonly definition = {
		name: QuizToolName.CoreReviewPlan,
		description: 'Present a plan to the user for review and approval. Provide the plan content as markdown, a list of approval actions (with optional default), and whether the user can provide freeform feedback. Optionally provide a URI to the backing plan file so the user can edit it. The tool returns the chosen action, whether the plan was rejected, and any feedback.',
		inputSchema: {
			type: 'object',
			required: ['content', 'actions', 'canProvideFeedback'],
			properties: {
				title: {
					description: 'Title displayed in the widget header. Defaults to "Review plan" if omitted.',
					type: 'string',
				},
				plan: {
					description: 'Optional URI of an editable plan file. An Edit button in the widget header opens it in the editor.',
					type: 'string',
				},
				content: {
					description: 'Markdown content rendered in the body of the widget. May be the plan summary or full plan text.',
					type: 'string',
				},
				actions: {
					description: 'List of approval actions offered in the primary dropdown button. Order is preserved.',
					type: 'array',
					items: {
						type: 'object',
						properties: {
							label: { type: 'string', description: 'Short action label shown in the dropdown button.' },
							description: { type: 'string', description: 'Optional detail shown below the label in the dropdown list.' },
							default: { type: 'boolean', description: 'Whether this action should be selected by default.' },
							permissionLevel: { type: 'string', enum: ['autopilot'], description: 'When set to "autopilot", a confirmation dialog is shown before proceeding.' },
						},
						required: ['label'],
					},
					minItems: 1,
				},
				canProvideFeedback: {
					description: 'When true, an additional feedback textarea is shown below the plan content.',
					type: 'boolean',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _chatService: IChatService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async prepareInvocation(parameters: IQuizReviewPlanInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		if (!parameters.actions || parameters.actions.length === 0) {
			throw new Error('At least one approval action must be provided.');
		}
		return {
			invocationMessage: 'Asking you to review the plan',
		};
	}

	override async invoke(parameters: IQuizReviewPlanInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		if (!parameters.actions || parameters.actions.length === 0) {
			return quizToolResultError('At least one approval action must be provided.');
		}

		const chatSessionResource = context.sessionResource;
		if (!chatSessionResource) {
			this._logService.warn('[QuizReviewPlanTool] Missing chat context; returning rejected result.');
			return quizToolResultText(JSON.stringify({ rejected: true }));
		}

		try {
			// Parse plan URI (aligned with Copilot's ReviewPlanTool)
			let planUri: URI | undefined;
			if (parameters.plan) {
				try {
					planUri = URI.parse(parameters.plan);
				} catch {
					try {
						planUri = URI.file(parameters.plan);
					} catch {
						planUri = undefined;
					}
				}
			}

			const reviewData = new ChatPlanReviewData(
				parameters.title ?? 'Review plan',
				parameters.content,
				parameters.actions.map(a => ({ label: a.label, description: a.description, default: a.default })),
				parameters.canProvideFeedback,
				planUri?.toJSON(),
				generateUuid(),
			);

			// Append the plan review to the chat progress (aligned with Copilot's chatService.appendProgress)
			const model = this._chatService.getSession(chatSessionResource);
			if (!model) {
				return quizToolResultText(JSON.stringify({ rejected: true }));
			}
			const request = model.getRequests().at(-1);
			if (!request) {
				return quizToolResultText(JSON.stringify({ rejected: true }));
			}
			this._chatService.appendProgress(request, reviewData);

			// Wait for the user to respond (aligned with Copilot's raceCancellation pattern)
			const result = await raceCancellation(reviewData.completion.p, token);
			if (token.isCancellationRequested) {
				throw new CancellationError();
			}

			return quizToolResultText(JSON.stringify(result ?? { rejected: true }));
		} catch (error) {
			if (error instanceof CancellationError) {
				throw error;
			}
			return quizToolResultError(`Failed to review plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}

// #endregion

// #region QuizSwitchAgentToolImpl (browser-layer, aligned with Copilot's SwitchAgentTool)

export interface IQuizSwitchAgentInput {
	agentName: string;
}

export class QuizSwitchAgentToolImpl extends QuizBuiltinTool<IQuizSwitchAgentInput> {

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
			// Agent switching is handled by the chat agent service
			// In browser layer, we emit the request and let the chat infrastructure handle it
			return quizToolResultText(`[Agent switch to "${parameters.agentName}" requested — this is handled by the chat infrastructure]`);
		} catch (err) {
			return quizToolResultError(`Failed to switch agent: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizToolSearchToolImpl (browser-layer, aligned with Copilot's ToolSearchTool)

export interface IQuizToolSearchInput {
	query: string;
}

export class QuizToolSearchToolImpl extends QuizBuiltinTool<IQuizToolSearchInput> {

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

	constructor(
		private readonly _toolsService: IQuizToolsService,
	) {
		super();
	}

	override async invoke(parameters: IQuizToolSearchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const query = parameters.query.toLowerCase();
			const results: string[] = [];

			// Search through registered copilot tools
			const tools = this._toolsService.copilotTools;
			if (tools) {
				for (const [name] of tools) {
					if (name.toLowerCase().includes(query)) {
						results.push(`- ${name}`);
					}
				}
			}

			if (results.length === 0) {
				return quizToolResultText(`No tools found matching "${parameters.query}"`);
			}

			return quizToolResultText(`Tools matching "${parameters.query}":\n${results.join('\n')}`);
		} catch (err) {
			return quizToolResultError(`Failed to search tools: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizVSCodeAPIToolImpl (browser-layer, aligned with Copilot's VSCodeAPITool)

export interface IQuizVSCodeAPIInput {
	query: string;
}

export class QuizVSCodeAPIToolImpl extends QuizBuiltinTool<IQuizVSCodeAPIInput> {

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
			// VS Code API docs search requires external service or embedded docs
			// In browser layer, provide a helpful pointer
			return quizToolResultText(`VS Code API search for "${parameters.query}":\n[VS Code API documentation search requires the vscode.d.ts type definitions or an external documentation service. Refer to https://code.visualstudio.com/api/references/vscode-api for the full API reference.]`);
		} catch (err) {
			return quizToolResultError(`Failed to get VS Code API: ${String(err)}`);
		}
	}
}

// #endregion

/**
 * Register all browser-layer VS Code interaction tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserVscodeTools(
	commandService: ICommandService,
	toolsService: IQuizToolsService,
	chatTodoListService: IChatTodoListService,
	chatService: IChatService,
	logService: ILogService,
): void {
	QuizBuiltinToolRegistry.register(new QuizRunVscodeCommandToolImpl(commandService));
	QuizBuiltinToolRegistry.register(new QuizManageTodoListToolImpl(chatTodoListService, logService));
	QuizBuiltinToolRegistry.register(new QuizConfirmationToolImpl());
	QuizBuiltinToolRegistry.register(new QuizConfirmationWithOptionsToolImpl());
	QuizBuiltinToolRegistry.register(new QuizModifiedFilesConfirmationToolImpl());
	QuizBuiltinToolRegistry.register(new QuizAskQuestionsToolImpl(chatService, logService));
	QuizBuiltinToolRegistry.register(new QuizReviewPlanToolImpl(chatService, logService));
	QuizBuiltinToolRegistry.register(new QuizSwitchAgentToolImpl());
	QuizBuiltinToolRegistry.register(new QuizToolSearchToolImpl(toolsService));
	QuizBuiltinToolRegistry.register(new QuizVSCodeAPIToolImpl());
}
