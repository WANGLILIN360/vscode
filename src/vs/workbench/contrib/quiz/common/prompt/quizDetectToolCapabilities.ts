/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuizToolName, quizAgenticBrowserTools } from '../tools/quizToolNames.js';
import type { IQuizToolInfo } from '../intents/quizIntents.js';

// #region QuizToolCapabilities (aligned with Copilot's ToolCapabilities / detectToolCapabilities)

/**
 * Pure TypeScript equivalent of Copilot's `ToolCapabilities` interface and
 * `detectToolCapabilities()` function from `defaultAgentInstructions.tsx`.
 *
 * Copilot uses this to dynamically adjust the system prompt based on which
 * tools are available to the current request. For example:
 * - If `read_file` is available, add instructions about reading context
 * - If `edit_file` is available, add instructions about editing
 * - If no edit tools are available, tell the model to ask the user
 *
 * Since Quiz has the same tool names (via `QuizToolName`), the same
 * capability detection logic applies directly.
 */

/**
 * Detected tool capabilities for the current request.
 * Aligned with Copilot's `ToolCapabilities` interface.
 */
export interface IQuizToolCapabilities extends Partial<Record<QuizToolName, boolean>> {
	/** Whether any file-editing tool is available */
	readonly hasSomeEditTool: boolean;
	/** Whether agentic browser tools (click, screenshot, etc.) are available */
	readonly hasAgenticBrowserTools: boolean;
}

/**
 * Detect which tool capabilities are available from the given tool list.
 * Aligned with Copilot's `detectToolCapabilities()`.
 *
 * @param availableTools The tools available for this request (from IQuizToolsService)
 * @returns A capabilities map indicating which tools are present
 */
export function quizDetectToolCapabilities(availableTools: readonly IQuizToolInfo[] | undefined): IQuizToolCapabilities {
	const toolMap: Partial<Record<QuizToolName, boolean>> = {};
	const available = new Set(availableTools?.map(t => t.name) ?? []);

	for (const name of Object.values(QuizToolName) as QuizToolName[]) {
		toolMap[name] = available.has(name as string);
	}

	return {
		...toolMap,
		hasSomeEditTool: !!(toolMap[QuizToolName.EditFile] || toolMap[QuizToolName.ReplaceString] || toolMap[QuizToolName.ApplyPatch]),
		hasAgenticBrowserTools: quizAgenticBrowserTools.some(tool => toolMap[tool]),
	};
}

/**
 * Build tool-dependent prompt instructions based on detected capabilities.
 * This is the pure-TS equivalent of Copilot's conditional TSX rendering
 * in `DefaultAgentPrompt.render()` and `AlternateGPTPrompt.render()`.
 *
 * Instead of JSX like:
 *   {tools[ToolName.ReadFile] && <>Read files with the read_file tool.<br /></>}
 *
 * We use string concatenation with conditional includes.
 */
export function quizBuildToolDependentInstructions(caps: IQuizToolCapabilities): string {
	const lines: string[] = [];

	// --- Instructions tag content (aligned with DefaultAgentPrompt) ---
	if (caps[QuizToolName.SearchSubagent] || caps[QuizToolName.ExploreSubagent]) {
		const searchTool = caps[QuizToolName.SearchSubagent] ? QuizToolName.SearchSubagent : QuizToolName.ExploreSubagent;
		lines.push(`For any context searching, use ${searchTool} to search and gather data instead of directly calling ${QuizToolName.FindTextInFiles}, ${QuizToolName.Codebase} or ${QuizToolName.FindFiles}.`);
	}
	if (caps[QuizToolName.ExecutionSubagent]) {
		lines.push(`For most execution tasks and terminal commands, use ${QuizToolName.ExecutionSubagent} to run commands and get relevant portions of the output instead of using ${QuizToolName.CoreRunInTerminal}. Use ${QuizToolName.CoreRunInTerminal} in rare cases when you want the entire output of a single command without truncation.`);
	}
	if (caps[QuizToolName.ReadFile]) {
		lines.push(`Some attachments may be summarized with omitted sections like \`/* Lines 123-456 omitted */\`. You can use the ${QuizToolName.ReadFile} tool to read more context if needed. Never pass this omitted line marker to an edit tool.`);
	}
	if (!caps.hasSomeEditTool) {
		lines.push('You don\'t currently have any tools available for editing files. If the user asks you to edit a file, you can ask the user to enable editing tools or print a codeblock with the suggested changes.');
	}
	if (!caps[QuizToolName.CoreRunInTerminal]) {
		lines.push('You don\'t currently have any tools available for running terminal commands. If the user asks you to run a terminal command, you can ask the user to enable terminal tools or print a codeblock with the suggested command.');
	}

	return lines.join('\n');
}

/**
 * Build tool-use instructions based on detected capabilities.
 * Aligned with Copilot's `toolUseInstructions` tag content.
 */
export function quizBuildToolUseInstructions(caps: IQuizToolCapabilities): string {
	const lines: string[] = [];

	lines.push('If the user is requesting a code sample, you can answer it directly without using any tools.');
	lines.push('When using a tool, follow the JSON schema very carefully and make sure to include ALL required properties.');
	lines.push('No need to ask permission before using a tool.');
	lines.push(`NEVER say the name of a tool to a user. For example, instead of saying that you'll use the ${QuizToolName.CoreRunInTerminal} tool, say "I'll run the command in a terminal".`);

	if (caps[QuizToolName.SearchSubagent] || caps[QuizToolName.ExploreSubagent]) {
		const searchTool = caps[QuizToolName.SearchSubagent] ? QuizToolName.SearchSubagent : QuizToolName.ExploreSubagent;
		lines.push(`For any context searching, use ${searchTool} to search and gather data instead of directly calling ${QuizToolName.FindTextInFiles}, ${QuizToolName.Codebase} or ${QuizToolName.FindFiles}.`);
	}
	if (caps[QuizToolName.ExecutionSubagent]) {
		lines.push(`For most execution tasks and terminal commands, use ${QuizToolName.ExecutionSubagent} to run commands and get relevant portions of the output instead of using ${QuizToolName.CoreRunInTerminal}.`);
	}

	lines.push('If you think running multiple tools can answer the user\'s question, prefer calling them in parallel whenever possible.');
	if (caps[QuizToolName.Codebase]) {
		lines.push(`But do not call ${QuizToolName.Codebase} in parallel.`);
	}

	if (caps[QuizToolName.ReadFile]) {
		lines.push(`When using the ${QuizToolName.ReadFile} tool, prefer reading a large section over calling the ${QuizToolName.ReadFile} tool many times in sequence. You can also think of all the pieces you may be interested in and read them in parallel. Read large enough context to ensure you get what you need.`);
	}
	if (caps[QuizToolName.FindTextInFiles]) {
		lines.push(`You can use the ${QuizToolName.FindTextInFiles} to get an overview of a file by searching for a string within that one file, instead of using ${QuizToolName.ReadFile} many times.`);
	}
	if (caps[QuizToolName.CoreRunInTerminal]) {
		lines.push(`Don't call the ${QuizToolName.CoreRunInTerminal} tool multiple times in parallel. Instead, run one command and wait for the output before running the next command.`);
	}
	lines.push('When invoking a tool that takes a file path, always use the absolute file path. If the file has a scheme like untitled: or vscode-userdata:, then use a URI with the scheme.');
	if (caps[QuizToolName.CoreRunInTerminal]) {
		lines.push('NEVER try to edit a file by running terminal commands unless the user specifically asks for it.');
	}
	if (caps[QuizToolName.CoreOpenBrowserPage] && caps.hasAgenticBrowserTools) {
		const browserTool = quizAgenticBrowserTools.find(k => caps[k]);
		lines.push(`Use the browser tools (${QuizToolName.CoreOpenBrowserPage}${browserTool ? `, ${browserTool}` : ''}, etc.) when beneficial for front-end tasks, such as when visualizing or validating UI changes.`);
	}
	lines.push('Tools can be disabled by the user. You may see tools used previously in the conversation that are not currently available. Be careful to only use the tools that are currently available to you.');

	return lines.join('\n');
}

/**
 * Build editing instructions based on detected capabilities.
 * Aligned with Copilot's `editFileInstructions` tag content.
 */
export function quizBuildEditInstructions(caps: IQuizToolCapabilities): string {
	const EXISTING_CODE_MARKER = '...';

	if (!caps.hasSomeEditTool) {
		return '';
	}

	const lines: string[] = [];

	if (caps[QuizToolName.ReplaceString]) {
		lines.push(`Before you edit an existing file, make sure you either already have it in the provided context, or read it with the ${QuizToolName.ReadFile} tool, so that you can make proper changes.`);
		if (caps[QuizToolName.MultiReplaceString]) {
			lines.push(`Use the ${QuizToolName.ReplaceString} tool for single string replacements, paying attention to context to ensure your replacement is unique. Prefer the ${QuizToolName.MultiReplaceString} tool when you need to make multiple string replacements across one or more files in a single operation.`);
		} else {
			lines.push(`Use the ${QuizToolName.ReplaceString} tool to edit files, paying attention to context to ensure your replacement is unique. You can use this tool multiple times per file.`);
		}
	}

	if (caps[QuizToolName.EditFile]) {
		if (!caps[QuizToolName.ReplaceString]) {
			lines.push(`Don't try to edit an existing file without reading it first, so you can make changes properly.`);
			lines.push(`Use the ${QuizToolName.EditFile} tool to edit files. When editing files, group your changes by file.`);
		}
		lines.push('NEVER show the changes to the user, just call the tool, and the edits will be applied and shown to the user.');
		lines.push(`NEVER print a codeblock that represents a change to a file, use ${caps[QuizToolName.ReplaceString] ? `${QuizToolName.ReplaceString} or ` : ''}${QuizToolName.EditFile} instead.`);
		lines.push(`When you use the ${QuizToolName.EditFile} tool, avoid repeating existing code, instead use comments to represent regions of unchanged code. The tool prefers that you are as concise as possible. For example:`);
		lines.push(`// ${EXISTING_CODE_MARKER}`);
		lines.push('changed code');
		lines.push(`// ${EXISTING_CODE_MARKER}`);
	}

	if (caps[QuizToolName.ApplyPatch]) {
		lines.push(`Use the ${QuizToolName.ApplyPatch} tool to apply patches to files.`);
	}

	return lines.join('\n');
}

// #endregion
