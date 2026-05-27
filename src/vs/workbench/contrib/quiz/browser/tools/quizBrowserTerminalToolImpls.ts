/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer terminal tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's terminal tools (runInTerminal, getTerminalOutput, etc.)

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { ITerminalService, type ITerminalInstance, ITerminalGroupService } from '../../../terminal/browser/terminal.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { TerminalCapability, type ICommandDetectionCapability, type ITerminalCommand } from '../../../../../platform/terminal/common/capabilities/capabilities.js';
import { ShellIntegrationStatus } from '../../../../../platform/terminal/common/terminal.js';

// #region IActiveTerminalExecution (aligned with Copilot's IActiveTerminalExecution)

/**
 * Tracks an active terminal execution for output retrieval and completion tracking.
 * Aligned with Copilot's RunInTerminalTool._activeExecutions pattern.
 */
interface IActiveTerminalExecution {
	readonly instance: ITerminalInstance;
	readonly termId: string;
	getOutput(): string;
	dispose(): void;
}

/** Active terminal executions indexed by termId (aligned with Copilot's _activeExecutions) */
const activeExecutions = new Map<string, IActiveTerminalExecution>();

/** Terminal IDs killed by the kill_terminal tool (aligned with Copilot's _killedByTool) */
const killedByTool = new Set<string>();

function getActiveExecution(id: string): IActiveTerminalExecution | undefined {
	return activeExecutions.get(id);
}

function markKilledByTool(id: string): void {
	killedByTool.add(id);
}

// #endregion

// #region Shell integration helpers (aligned with Copilot's shell integration quality detection)

/**
 * Get the command detection capability from a terminal instance, if available.
 * Aligned with Copilot's getCommandDetectionCapability pattern.
 */
function getCommandDetectionCapability(instance: ITerminalInstance): ICommandDetectionCapability | undefined {
	const caps = instance.capabilities;
	if (!caps) {
		return undefined;
	}
	return caps.get(TerminalCapability.CommandDetection) as ICommandDetectionCapability | undefined;
}

/**
 * Check whether shell integration is available and has command detection.
 * Aligned with Copilot's hasShellIntegration pattern.
 */
function hasCommandDetection(instance: ITerminalInstance): boolean {
	return getCommandDetectionCapability(instance) !== undefined;
}

/**
 * Wait for shell integration to become available, with a timeout.
 * Aligned with Copilot's waitForShellIntegration pattern.
 */
async function waitForShellIntegration(instance: ITerminalInstance, timeoutMs: number, token: CancellationToken): Promise<ICommandDetectionCapability | undefined> {
	// Check if already available
	const existing = getCommandDetectionCapability(instance);
	if (existing) {
		return existing;
	}

	// Wait for shell integration status to change
	const si = instance.xterm?.shellIntegration;
	if (!si) {
		return undefined;
	}

	if (si.status === ShellIntegrationStatus.VSCode || si.status === ShellIntegrationStatus.FinalTerm) {
		return getCommandDetectionCapability(instance);
	}

	// Wait for onDidChangeStatus event
	const deferred = new DeferredPromise<ICommandDetectionCapability | undefined>();
	const timer = setTimeout(() => deferred.complete(undefined), timeoutMs);

	const listener = si.onDidChangeStatus((status: ShellIntegrationStatus) => {
		if (status === ShellIntegrationStatus.VSCode || status === ShellIntegrationStatus.FinalTerm) {
			clearTimeout(timer);
			listener.dispose();
			deferred.complete(getCommandDetectionCapability(instance));
		}
	});

	const tokenListener = token.onCancellationRequested(() => {
		clearTimeout(timer);
		listener.dispose();
		tokenListener.dispose();
		deferred.complete(undefined);
	});

	try {
		return await deferred.p;
	} finally {
		clearTimeout(timer);
		listener.dispose();
		tokenListener.dispose();
	}
}

// #endregion

// #region QuizRunInTerminalToolImpl (browser-layer, aligned with Copilot's RunInTerminalTool)

export interface IQuizRunInTerminalInput {
	command: string;
	explanation: string;
	goal: string;
	mode?: 'sync' | 'async';
	timeout?: number;
}

export class QuizRunInTerminalToolImpl extends QuizBuiltinTool<IQuizRunInTerminalInput> {

	readonly toolName = QuizToolName.CoreRunInTerminal;

	readonly definition = {
		name: QuizToolName.CoreRunInTerminal,
		description: `Run a command in the terminal.

Command Execution:
- Use && to chain simple commands on one line
- Prefer pipelines | for object-based data flow
- Never create a sub-shell (eg. powershell -c "command") unless explicitly asked

Directory Management:
- Prefer relative paths when navigating directories, only use absolute when the path is far away or the current cwd is not expected
- Use $PWD or Get-Location for current directory
- Use Push-Location/Pop-Location for directory stack

Program Execution:
- Supports .NET, Python, Node.js, and other executables
- Install modules via Install-Module, Install-Package
- Use Get-Command to verify cmdlet/function availability

Async Mode:
- Use mode=async ONLY for processes that should keep running while you do other work (servers, watchers, dev daemons)
- For one-shot long-running commands where you have nothing to do until they finish (package installs, builds, downloads, test suites), use mode=sync with a generous timeout (e.g. 600000 / 10 min for installs, longer for big builds) so the command can complete before your turn ends
- Returns a terminal ID for checking status and runtime later
- Use Start-Job for background PowerShell jobs

Output Management:
- Output is automatically truncated if longer than 60KB to prevent context overflow
- Use Select-Object, Where-Object, Format-Table to filter output
- Use -First/-Last parameters to limit results
- For pager commands, add | Out-String or | Format-List

Best Practices:
- Use proper cmdlet names instead of aliases in scripts
- Quote paths with spaces: "C:\\Path With Spaces"
- Prefer PowerShell cmdlets over external commands when available
- Prefer idiomatic PowerShell like Get-ChildItem instead of dir or ls for file listings
- Use Test-Path to check file/directory existence
- Be specific with Select-Object properties to avoid excessive output
- Avoid printing credentials unless absolutely required
- NEVER run Start-Sleep or similar wait commands. You will be automatically notified on your next turn when async terminal commands or timed-out sync commands complete or need input. Do NOT poll for completion.

Interactive Input Handling:
- When a terminal command is waiting for interactive input, do NOT suggest alternatives or ask the user whether to proceed. Instead, use the vscode_askQuestions tool to collect the needed values from the user, then send them.
- NEVER use vscode_askQuestions to request sensitive input such as passwords, passphrases, API keys, tokens, or other secrets — answers to that tool are sent through the model. If the prompt requires a secret, tell the user to type it directly into the terminal and stop; do not call vscode_askQuestions or send_to_terminal for that prompt.
- Send exactly one answer per prompt using send_to_terminal. Never send multiple answers in a single send.
- After each send, call get_terminal_output to read the next prompt before sending the next answer.
- Continue one prompt at a time until the command finishes.

Execution mode:
- mode='sync': wait for completion (optionally capped by timeout); if still running when timeout elapses, return with a terminal ID.
- mode='async': wait for an initial idle/output signal, then return with a terminal output snapshot and ID. Timeout caps how long to wait for the initial idle/output signal.
- Prefer mode='sync' for commands that will prompt for interactive input (e.g., npm init, interactive installers, configuration wizards).

Timeout parameter: For one-shot long-running commands, set a generous timeout as a safety net (e.g. 600000 for installs, longer for big builds). Omit timeout only for processes that should run indefinitely (servers, daemons). If the timeout elapses, you get a terminal ID and can check output later.

Terminal notifications: When an async command finishes or a sync command times out, you will be automatically notified on your next turn with the exit code and terminal output. You will also be notified if the terminal needs input. Do NOT poll or sleep to wait for completion.`,
		inputSchema: {
			type: 'object',
			required: ['command', 'explanation', 'goal', 'mode'],
			properties: {
				command: {
					description: 'The command to run in the terminal.',
					type: 'string',
				},
				explanation: {
					description: 'A one-sentence description of what the command does. This will be shown to the user before the command is run.',
					type: 'string',
				},
				goal: {
					description: 'A short description of the goal or purpose of the command (e.g., "Install dependencies", "Start development server").',
					type: 'string',
				},
				mode: {
					description: 'Execution mode for this command.',
					type: 'string',
					enum: ['sync', 'async'],
				},
				timeout: {
					description: 'Optional hard cap in milliseconds on how long the tool tracks the command before returning. Omit to let the command run to completion.',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _terminalService: ITerminalService,
		private readonly _terminalGroupService: ITerminalGroupService,
		private readonly _workspaceContextService: IWorkspaceContextService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async invoke(parameters: IQuizRunInTerminalInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const cwd = this._workspaceContextService.getWorkspace().folders[0]?.uri.fsPath;
			const mode = parameters.mode ?? 'sync';

			const instance = await this._terminalService.createTerminal({
				config: { cwd },
			});

			if (!instance) {
				return quizToolResultError('Failed to create terminal instance');
			}

			// Show the terminal and send the command (aligned with Copilot)
			this._terminalService.setActiveInstance(instance);
			this._terminalGroupService.showPanel(false);

			// Generate a stable termId for this execution (aligned with Copilot's termId pattern)
			const termId = `term-${generateUuid()}`;

			// Register active execution (aligned with Copilot's _activeExecutions)
			const execution: IActiveTerminalExecution = {
				instance,
				termId,
				getOutput: () => cleanTerminalOutput(readTerminalBuffer(instance)),
				dispose: () => {
					activeExecutions.delete(termId);
				},
			};
			activeExecutions.set(termId, execution);

			// Check if shell integration is available and wait for it if needed
			// Aligned with Copilot's shell integration quality detection
			const commandDetection = hasCommandDetection(instance)
				? getCommandDetectionCapability(instance)
				: await waitForShellIntegration(instance, 2000, token);

			// Wait briefly for the terminal to be ready, then send the command
			await new Promise<void>(resolve => setTimeout(resolve, 100));
			instance.sendText(parameters.command + '\n', true);

			if (mode === 'sync') {
				const timeout = parameters.timeout ?? 60000;

				if (commandDetection) {
					// Use shell integration for completion detection (aligned with Copilot)
					this._logService.debug('[QuizRunInTerminal] Using shell integration for command completion');
					const result = await this._waitForCommandCompletionViaShellIntegration(instance, commandDetection, timeout, termId, token);
					return result;
				}

				// Fall back to output stability polling (current behavior)
				this._logService.debug('[QuizRunInTerminal] Shell integration not available, using output stability polling');
				const output = await this._waitForOutputStability(instance, timeout, token);
				if (output === '[Timed out]') {
					return quizToolResultText(`Terminal ${termId} (timed out after ${timeout}ms):\nUse get_terminal_output with terminalId="${termId}" to check status.`);
				}
				return quizToolResultText(`Terminal ${termId}:\n${output}`);
			}

			// Async mode: wait briefly for initial output, then return with termId
			// Aligned with Copilot's async mode — wait for an initial idle/output signal
			const output = await this._waitForOutputStability(instance, 5000, token);
			return quizToolResultText(`Terminal ${termId} (async):\n${output}\n\n[Command is running in the background. Use get_terminal_output with terminalId="${termId}" to check status.]`);

		} catch (err) {
			if (err instanceof CancellationError) {
				throw err;
			}
			return quizToolResultError(`Failed to run terminal command: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizRunInTerminalInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			confirmationMessages: {
				title: parameters.goal ?? 'Run terminal command?',
				message: `${parameters.explanation ?? ''}\n\nCommand: \`${parameters.command}\``,
			},
			invocationMessage: `Running: ${parameters.command}`,
		};
	}

	/**
	 * Wait for command completion using shell integration's ICommandDetectionCapability.
	 * Aligned with Copilot's OutputMonitor pattern — uses onCommandFinished event
	 * for reliable completion detection instead of output-stability polling.
	 */
	private async _waitForCommandCompletionViaShellIntegration(
		instance: ITerminalInstance,
		commandDetection: ICommandDetectionCapability,
		timeoutMs: number,
		termId: string,
		token: CancellationToken
	): Promise<IQuizToolResult> {
		const deferred = new DeferredPromise<IQuizToolResult>();
		const timer = setTimeout(() => {
			// Timeout — return terminal ID for later checking
			this._logService.debug('[QuizRunInTerminal] Command timed out via shell integration detection');
			deferred.complete(quizToolResultText(`Terminal ${termId} (timed out after ${timeoutMs}ms):\nUse get_terminal_output with terminalId="${termId}" to check status.`));
		}, timeoutMs);

		const commandListener = commandDetection.onCommandFinished((cmd: ITerminalCommand) => {
			this._logService.debug(`[QuizRunInTerminal] Command finished via shell integration: ${cmd.command}, exitCode=${cmd.exitCode}`);
			clearTimeout(timer);
			commandListener.dispose();
			tokenListener.dispose();

			// Use ITerminalCommand.getOutput() for scoped output (aligned with Copilot)
			const cmdOutput = cmd.getOutput();
			const output = cmdOutput ? cleanTerminalOutput(cmdOutput) : cleanTerminalOutput(readTerminalBuffer(instance));
			const exitInfo = cmd.exitCode !== undefined ? `\n[Exit code: ${cmd.exitCode}]` : '';

			deferred.complete(quizToolResultText(`Terminal ${termId}:\n${output}${exitInfo}`));
		});

		const tokenListener = token.onCancellationRequested(() => {
			clearTimeout(timer);
			commandListener.dispose();
			tokenListener.dispose();
			deferred.complete(quizToolResultText(`Terminal ${termId}: [Cancelled]`));
		});

		try {
			return await deferred.p;
		} finally {
			clearTimeout(timer);
			commandListener.dispose();
			tokenListener.dispose();
		}
	}

	/**
	 * Wait for output stability using polling (fallback when shell integration is not available).
	 * Aligned with Copilot's output stability check pattern — waits for output to stabilize.
	 */
	private async _waitForOutputStability(instance: ITerminalInstance, timeoutMs: number, token: CancellationToken): Promise<string> {
		const startTime = Date.now();
		let lastLength = 0;
		let stableCount = 0;

		while (Date.now() - startTime < timeoutMs && !token.isCancellationRequested) {
			await new Promise<void>(resolve => setTimeout(resolve, 500));

			try {
				const content = readTerminalBuffer(instance);
				if (content.length > 0 && content.length === lastLength) {
					stableCount++;
					if (stableCount >= 2) {
						return cleanTerminalOutput(content);
					}
				} else {
					stableCount = 0;
				}
				lastLength = content.length;
			} catch {
				// Buffer access may not be available
			}
		}

		return '[Timed out]';
	}
}

// Shared helper for cleaning terminal output (aligned with Copilot's stripAnsi pattern)
function cleanTerminalOutput(output: string): string {
	return output
		.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
		.replace(/\x1b\].*?\x07/g, '')
		.replace(/\r\n/g, '\n')
		.trim();
}

// Shared helper for reading terminal output from buffer (aligned with Copilot's readBuffer pattern)
function readTerminalBuffer(instance: ITerminalInstance, maxLines: number = 50): string {
	const buffer = instance.xterm?.raw?.buffer?.active;
	if (!buffer) {
		return '';
	}
	const lines: string[] = [];
	const length = buffer.length;
	for (let i = Math.max(0, length - maxLines); i < length; i++) {
		try {
			const line = buffer.getLine(i);
			if (line) {
				lines.push(line.translateToString(true));
			}
		} catch {
			break;
		}
	}
	return lines.join('\n');
}


// #endregion

// #region QuizGetTerminalOutputToolImpl (browser-layer, aligned with Copilot's GetTerminalOutputTool)

export interface IQuizGetTerminalOutputInput {
	id: string;
}

export class QuizGetTerminalOutputToolImpl extends QuizBuiltinTool<IQuizGetTerminalOutputInput> {

	readonly toolName = QuizToolName.CoreGetTerminalOutput;

	readonly definition = {
		name: QuizToolName.CoreGetTerminalOutput,
		description: `Get output from an active terminal execution (identified by the \`id\` returned from run_in_terminal). This tool has a higher token limit for output length than the runNotebookCell tool.`,
		inputSchema: {
			type: 'object',
			required: ['id'],
			properties: {
				id: {
					description: 'The ID of an active terminal execution to get output from. The ' +
						'exact opaque UUID returned by that tool; terminal names, labels, or integers are invalid.',
					type: 'string',
					pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _terminalService: ITerminalService,
	) {
		super();
	}

	override async invoke(parameters: IQuizGetTerminalOutputInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Try active execution first (aligned with Copilot's RunInTerminalTool.getExecution)
			const execution = getActiveExecution(parameters.id);
			if (execution) {
				// Use shell integration to get command-specific output if available (aligned with Copilot)
				const commandDetection = getCommandDetectionCapability(execution.instance);
				if (commandDetection) {
					const commands = commandDetection.commands;
					if (commands.length > 0) {
						const lastCmd = commands[commands.length - 1];
						const cmdOutput = lastCmd.getOutput();
						if (cmdOutput) {
							return quizToolResultText(cleanTerminalOutput(cmdOutput));
						}
					}
				}

				const output = execution.getOutput();
				return quizToolResultText(output || '[No output available]');
			}

			// Fallback: search by instanceId (for terminals not started by this tool)
			const instance = this._terminalService.getInstanceFromId(Number(parameters.id));
			if (!instance) {
				return quizToolResultError(`Terminal not found: ${parameters.id}`);
			}

			// Use shell integration if available (aligned with Copilot)
			const commandDetection = getCommandDetectionCapability(instance);
			if (commandDetection) {
				const commands = commandDetection.commands;
				if (commands.length > 0) {
					const lastCmd = commands[commands.length - 1];
					const cmdOutput = lastCmd.getOutput();
					if (cmdOutput) {
						return quizToolResultText(cleanTerminalOutput(cmdOutput));
					}
				}
			}

			try {
				const buffer = instance.xterm?.raw?.buffer?.active;
				if (buffer) {
					const lines: string[] = [];
					const length = buffer.length;
					for (let i = Math.max(0, length - 100); i < length; i++) {
						try {
							const line = buffer.getLine(i);
							if (line) {
								lines.push(line.translateToString(true));
							}
						} catch {
							break;
						}
					}
					const output = lines.join('\n')
						.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
						.replace(/\x1b\].*?\x07/g, '')
						.replace(/\r\n/g, '\n')
						.trim();
					return quizToolResultText(output || '[No output available]');
				}
			} catch {
				// Buffer access may not be available
			}

			return quizToolResultText(`[Terminal output for ${parameters.id} is not accessible via buffer API]`);
		} catch (err) {
			return quizToolResultError(`Failed to get terminal output: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizSendToTerminalToolImpl (browser-layer, aligned with Copilot's SendToTerminalTool)

export interface IQuizSendToTerminalInput {
	terminalId: string;
	text: string;
	waitForOutput?: boolean;
}

export class QuizSendToTerminalToolImpl extends QuizBuiltinTool<IQuizSendToTerminalInput> {

	readonly toolName = QuizToolName.CoreSendToTerminal;

	readonly definition = {
		name: QuizToolName.CoreSendToTerminal,
		description: `Send input text to an active terminal execution (identified by the \`id\` returned from run_in_terminal).

The 'command' field may be empty or whitespace to press Enter (useful for interactive prompts). By default, returns the last 20 lines of terminal output captured shortly after sending. Set 'waitForOutput' to true for interactive programs (games, REPLs, etc.) to wait until the terminal becomes idle before returning output — this gives you the program's response to your input.`,
		inputSchema: {
			type: 'object',
			required: ['id', 'command'],
			properties: {
				id: {
					description: 'The ID of an active terminal execution to send a command to. The ' +
						'exact opaque UUID returned by that tool; terminal names, labels, or integers are invalid.',
					type: 'string',
					pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
				},
				command: {
					description: 'The input text to send to the terminal. The text is sent followed by Enter. Provide an empty or whitespace string to send just Enter (for interactive prompts).',
					type: 'string',
				},
				waitForOutput: {
					description: 'When true, waits for the terminal to become idle (no new output for a short period) before returning, instead of returning immediately. Useful for interactive programs where you need to see the full response to your input. Defaults to false.',
					type: 'boolean',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _terminalService: ITerminalService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async invoke(parameters: IQuizSendToTerminalInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Try active execution first (aligned with Copilot)
			const execution = getActiveExecution(parameters.terminalId);

			if (!execution) {
				// Fallback: search by instanceId (for terminals not started by this tool)
				const instance = this._terminalService.getInstanceFromId(Number(parameters.terminalId));
				if (!instance) {
					return quizToolResultError(`Terminal not found: ${parameters.terminalId}`);
				}

				// Send text — empty/whitespace means just press Enter (aligned with Copilot)
				instance.sendText(parameters.text, false);
				return quizToolResultText(`Text sent to terminal ${parameters.terminalId}`);
			}

			// Check if the terminal was killed by the kill_terminal tool (aligned with Copilot)
			if (killedByTool.has(parameters.terminalId)) {
				return quizToolResultError(`Terminal ${parameters.terminalId} has been killed. Cannot send input.`);
			}

			// Send text — empty/whitespace means just press Enter (aligned with Copilot)
			execution.instance.sendText(parameters.text, false);

			if (parameters.waitForOutput) {
				// Use shell integration for smarter output detection if available (aligned with Copilot)
				const commandDetection = getCommandDetectionCapability(execution.instance);
				if (commandDetection) {
					this._logService.debug('[QuizSendToTerminal] Using shell integration for output detection');
					const output = await this._waitForIdleOutput(execution.instance, commandDetection, 5000, token);
					return quizToolResultText(output || 'Text sent, no output yet');
				}

				// Fall back to simple wait (aligned with Copilot's default behavior)
				await new Promise<void>(resolve => setTimeout(resolve, 2000));
				const output = execution.getOutput();
				return quizToolResultText(output || 'Text sent, no output yet');
			}

			// Return last 20 lines captured shortly after sending (aligned with Copilot)
			await new Promise<void>(resolve => setTimeout(resolve, 500));
			const output = execution.getOutput();
			return quizToolResultText(output || 'Text sent, no output yet');
		} catch (err) {
			return quizToolResultError(`Failed to send to terminal: ${String(err)}`);
		}
	}

	/**
	 * Wait for terminal to become idle (no new output for a short period) using
	 * shell integration's command detection. Aligned with Copilot's waitForOutput pattern.
	 */
	private async _waitForIdleOutput(
		instance: ITerminalInstance,
		commandDetection: ICommandDetectionCapability,
		timeoutMs: number,
		token: CancellationToken
	): Promise<string | undefined> {
		const deferred = new DeferredPromise<string | undefined>();
		const timer = setTimeout(() => {
			deferred.complete(cleanTerminalOutput(readTerminalBuffer(instance)));
		}, timeoutMs);

		// Listen for command completion to know when output is stable
		const commandListener = commandDetection.onCommandFinished(() => {
			clearTimeout(timer);
			commandListener.dispose();
			tokenListener.dispose();
			deferred.complete(cleanTerminalOutput(readTerminalBuffer(instance)));
		});

		const tokenListener = token.onCancellationRequested(() => {
			clearTimeout(timer);
			commandListener.dispose();
			tokenListener.dispose();
			deferred.complete(undefined);
		});

		try {
			return await deferred.p;
		} finally {
			clearTimeout(timer);
			commandListener.dispose();
			tokenListener.dispose();
		}
	}
}

// #endregion

// #region QuizKillTerminalToolImpl (browser-layer, aligned with Copilot's KillTerminalTool)

export interface IQuizKillTerminalInput {
	terminalId: string;
}

export class QuizKillTerminalToolImpl extends QuizBuiltinTool<IQuizKillTerminalInput> {

	readonly toolName = QuizToolName.CoreKillTerminal;

	readonly definition = {
		name: QuizToolName.CoreKillTerminal,
		description: 'Kill a running terminal process. Use this to stop long-running or stuck commands. The final output will be returned before the terminal is killed.',
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

	constructor(
		private readonly _terminalService: ITerminalService,
	) {
		super();
	}

	override async invoke(parameters: IQuizKillTerminalInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Try active execution first (aligned with Copilot's getExecution + markKilledByTool)
			const execution = getActiveExecution(parameters.terminalId);
			if (execution) {
				// Get final output before killing (aligned with Copilot)
				const finalOutput = execution.getOutput();
				markKilledByTool(parameters.terminalId);
				await this._terminalService.safeDisposeTerminal(execution.instance);
				execution.dispose();
				return quizToolResultText(`Terminal ${parameters.terminalId} killed.\n\nFinal output:\n${finalOutput}`);
			}

			// Fallback: search by instanceId
			const instance = this._terminalService.getInstanceFromId(Number(parameters.terminalId));
			if (!instance) {
				return quizToolResultError(`Terminal not found: ${parameters.terminalId}`);
			}

			markKilledByTool(parameters.terminalId);
			await this._terminalService.safeDisposeTerminal(instance);
			return quizToolResultText(`Terminal ${parameters.terminalId} killed`);
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

// #endregion

// #region QuizTerminalSelectionToolImpl (browser-layer, aligned with Copilot's TerminalSelectionTool)

export interface IQuizTerminalSelectionInput {
	terminalId?: string;
}

export class QuizTerminalSelectionToolImpl extends QuizBuiltinTool<IQuizTerminalSelectionInput> {

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

	constructor(
		private readonly _terminalService: ITerminalService,
	) {
		super();
	}

	override async invoke(parameters: IQuizTerminalSelectionInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const instance = parameters.terminalId
				? this._terminalService.getInstanceFromId(Number(parameters.terminalId))
				: this._terminalService.activeInstance;

			if (!instance) {
				return quizToolResultError('No terminal instance available');
			}

			// Try to get selection first, then fall back to visible buffer
			try {
				const selection = instance.xterm?.raw?.getSelection();
				if (selection) {
					return quizToolResultText(selection);
				}
			} catch {
				// Selection API may not be available
			}

			// Fall back to visible buffer
			try {
				const buffer = instance.xterm?.raw?.buffer?.active;
				if (buffer) {
					const lines: string[] = [];
					const length = buffer.length;
					const viewportStart = buffer.viewportY;
					const viewportEnd = viewportStart + (instance.xterm?.raw?.rows ?? 24);
					for (let i = Math.max(0, viewportStart); i < Math.min(viewportEnd, length); i++) {
						try {
							const line = buffer.getLine(i);
							if (line) {
								lines.push(line.translateToString(true));
							}
						} catch {
							break;
						}
					}
					return quizToolResultText(lines.join('\n'));
				}
			} catch {
				// Buffer access may not be available
			}

			return quizToolResultText('[Terminal selection not available]');
		} catch (err) {
			return quizToolResultError(`Failed to get terminal selection: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizTerminalLastCommandToolImpl (browser-layer, aligned with Copilot's TerminalLastCommandTool)

export interface IQuizTerminalLastCommandInput {
	terminalId?: string;
}

export class QuizTerminalLastCommandToolImpl extends QuizBuiltinTool<IQuizTerminalLastCommandInput> {

	readonly toolName = QuizToolName.CoreTerminalLastCommand;

	readonly definition = {
		name: QuizToolName.CoreTerminalLastCommand,
		description: 'Get the last command that was run in the terminal.',
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

	constructor(
		private readonly _terminalService: ITerminalService,
	) {
		super();
	}

	override async invoke(parameters: IQuizTerminalLastCommandInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const instance = parameters.terminalId
				? this._terminalService.getInstanceFromId(Number(parameters.terminalId))
				: this._terminalService.activeInstance;

			if (!instance) {
				return quizToolResultError('No terminal instance available');
			}

			// Try shell integration command detection first (aligned with Copilot)
			// This gives us the exact last command with its output, exit code, and duration
			const commandDetection = getCommandDetectionCapability(instance);
			if (commandDetection) {
				const commands = commandDetection.commands;
				if (commands.length > 0) {
					const lastCmd = commands[commands.length - 1];
					const output = lastCmd.getOutput();
					const exitInfo = lastCmd.exitCode !== undefined ? `\n[Exit code: ${lastCmd.exitCode}]` : '';
					const durationInfo = lastCmd.duration > 0 ? `\n[Duration: ${lastCmd.duration}ms]` : '';
					return quizToolResultText(`Last command: ${lastCmd.command}${exitInfo}${durationInfo}\n\nOutput:\n${output ? cleanTerminalOutput(output) : '[No output]'}`);
				}

				// Check if a command is currently executing
				const executingCmd = commandDetection.executingCommand;
				if (executingCmd) {
					return quizToolResultText(`Currently executing: ${executingCmd}`);
				}

				return quizToolResultText('[No commands detected in this terminal session]');
			}

			// Fall back to reading the last portion of the terminal buffer
			try {
				const buffer = instance.xterm?.raw?.buffer?.active;
				if (buffer) {
					const lines: string[] = [];
					const length = buffer.length;
					// Read last 30 lines as a reasonable window for last command output
					for (let i = Math.max(0, length - 30); i < length; i++) {
						try {
							const line = buffer.getLine(i);
							if (line) {
								lines.push(line.translateToString(true));
							}
						} catch {
							break;
						}
					}
					const output = lines.join('\n')
						.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
						.replace(/\x1b\].*?\x07/g, '')
						.replace(/\r\n/g, '\n')
						.trim();
					return quizToolResultText(output || '[No recent output available]');
				}
			} catch {
				// Buffer access may not be available
			}

			return quizToolResultText('[Last command output not available]');
		} catch (err) {
			return quizToolResultError(`Failed to get last terminal command: ${String(err)}`);
		}
	}
}

// #endregion

/**
 * Register all browser-layer terminal tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserTerminalTools(
	terminalService: ITerminalService,
	terminalGroupService: ITerminalGroupService,
	workspaceContextService: IWorkspaceContextService,
	logService: ILogService,
): void {
	QuizBuiltinToolRegistry.register(new QuizRunInTerminalToolImpl(terminalService, terminalGroupService, workspaceContextService, logService));
	QuizBuiltinToolRegistry.register(new QuizGetTerminalOutputToolImpl(terminalService));
	QuizBuiltinToolRegistry.register(new QuizSendToTerminalToolImpl(terminalService, logService));
	QuizBuiltinToolRegistry.register(new QuizKillTerminalToolImpl(terminalService));
	QuizBuiltinToolRegistry.register(new QuizTerminalSelectionToolImpl(terminalService));
	QuizBuiltinToolRegistry.register(new QuizTerminalLastCommandToolImpl(terminalService));
}
