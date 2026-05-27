/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizToolInvocationContext } from './quizToolsService.js';
import { QuizToolName } from './quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from './quizBuiltinTools.js';

// #region RunSubagentTool (aligned with Copilot's RunSubagentTool)

export interface IQuizRunSubagentInput {
	prompt: string;
	subagent_type?: string;
}

export class QuizRunSubagentTool extends QuizBuiltinTool<IQuizRunSubagentInput> {

	readonly toolName = QuizToolName.CoreRunSubagent;

	readonly definition = {
		name: QuizToolName.CoreRunSubagent,
		description: 'Run a subagent with a specific prompt. The subagent will use its own tool calling loop to accomplish the task. Use this to delegate complex subtasks to a focused agent.',
		inputSchema: {
			type: 'object',
			required: ['prompt'],
			properties: {
				prompt: {
					description: 'The prompt to send to the subagent describing the task to accomplish.',
					type: 'string',
				},
				subagent_type: {
					description: 'Optional type of subagent to use (e.g., "search", "execution").',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizRunSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Subagent "${parameters.subagent_type ?? 'default'}" would be launched here with prompt: "${parameters.prompt.substring(0, 100)}..."]`);
		} catch (err) {
			return quizToolResultError(`Failed to run subagent: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizRunSubagentTool());

// #endregion

// #region SearchSubagentTool (aligned with Copilot's SearchSubagentTool)

export interface IQuizSearchSubagentInput {
	query: string;
	thoroughness?: 'normal' | 'deep';
}

export class QuizSearchSubagentTool extends QuizBuiltinTool<IQuizSearchSubagentInput> {

	readonly toolName = QuizToolName.SearchSubagent;

	readonly definition = {
		name: QuizToolName.SearchSubagent,
		description: 'Launch a search subagent that performs a thorough search across the workspace. Returns relevant code snippets, file paths, and context. Use this for complex search tasks that require multiple search strategies.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The search query describing what to find in the codebase.',
					type: 'string',
				},
				thoroughness: {
					description: 'How thorough the search should be. "deep" uses more search iterations.',
					type: 'string',
					enum: ['normal', 'deep'],
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizSearchSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Search subagent would be launched here for query: "${parameters.query}" with thoroughness: ${parameters.thoroughness ?? 'normal'}]`);
		} catch (err) {
			return quizToolResultError(`Failed to run search subagent: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizSearchSubagentTool());

// #endregion

// #region ExploreSubagentTool (aligned with Copilot's ExploreSubagentTool)

export interface IQuizExploreSubagentInput {
	query: string;
}

export class QuizExploreSubagentTool extends QuizBuiltinTool<IQuizExploreSubagentInput> {

	readonly toolName = QuizToolName.ExploreSubagent;

	readonly definition = {
		name: QuizToolName.ExploreSubagent,
		description: 'Launch an exploration subagent that reads and analyzes files to understand code structure. Use this to understand how code works, find relevant patterns, or explore unfamiliar codebases.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The exploration query describing what to understand about the codebase.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizExploreSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Explore subagent would be launched here for query: "${parameters.query}"]`);
		} catch (err) {
			return quizToolResultError(`Failed to run explore subagent: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizExploreSubagentTool());

// #endregion

// #region ExecutionSubagentTool (aligned with Copilot's ExecutionSubagentTool)

export interface IQuizExecutionSubagentInput {
	prompt: string;
	cwd?: string;
}

export class QuizExecutionSubagentTool extends QuizBuiltinTool<IQuizExecutionSubagentInput> {

	readonly toolName = QuizToolName.ExecutionSubagent;

	readonly definition = {
		name: QuizToolName.ExecutionSubagent,
		description: 'Launch an execution subagent that runs terminal commands to accomplish a task. Use this for tasks that require running build commands, tests, or other terminal operations.',
		inputSchema: {
			type: 'object',
			required: ['prompt'],
			properties: {
				prompt: {
					description: 'The prompt describing the execution task to accomplish.',
					type: 'string',
				},
				cwd: {
					description: 'Working directory for the execution subagent.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizExecutionSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Execution subagent would be launched here for prompt: "${parameters.prompt.substring(0, 100)}..."]`);
		} catch (err) {
			return quizToolResultError(`Failed to run execution subagent: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizExecutionSubagentTool());

// #endregion

// #region SkillTool (aligned with Copilot's SkillTool)

export interface IQuizSkillInput {
	skillId: string;
	input?: string;
}

export class QuizSkillTool extends QuizBuiltinTool<IQuizSkillInput> {

	readonly toolName = QuizToolName.Skill;

	readonly definition = {
		name: QuizToolName.Skill,
		description: 'Invoke a registered skill (e.g., a custom workflow or reusable prompt template). Skills are contributed by extensions and provide specialized capabilities.',
		inputSchema: {
			type: 'object',
			required: ['skillId'],
			properties: {
				skillId: {
					description: 'The ID of the skill to invoke.',
					type: 'string',
				},
				input: {
					description: 'Optional input text for the skill.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizSkillInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[Skill "${parameters.skillId}" would be invoked here via IChatSkillService]`);
		} catch (err) {
			return quizToolResultError(`Failed to invoke skill: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizSkillTool());

// #endregion

// #region GithubSearchTools (aligned with Copilot's GithubSemanticRepoSearch + GithubTextSearch)

export interface IQuizGithubRepoSearchInput {
	query: string;
}

export class QuizGithubSemanticRepoSearchTool extends QuizBuiltinTool<IQuizGithubRepoSearchInput> {

	readonly toolName = QuizToolName.GithubSemanticRepoSearch;

	readonly definition = {
		name: QuizToolName.GithubSemanticRepoSearch,
		description: 'Search GitHub repositories using semantic search. Returns relevant repositories with descriptions and URLs.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The search query for GitHub repositories.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGithubRepoSearchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[GitHub repo search results for "${parameters.query}" would be provided here via GitHub API]`);
		} catch (err) {
			return quizToolResultError(`Failed to search GitHub repos: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizGithubSemanticRepoSearchTool());

// #endregion

export interface IQuizGithubTextSearchInput {
	query: string;
	repo?: string;
}

export class QuizGithubTextSearchTool extends QuizBuiltinTool<IQuizGithubTextSearchInput> {

	readonly toolName = QuizToolName.GithubTextSearch;

	readonly definition = {
		name: QuizToolName.GithubTextSearch,
		description: 'Search for text within GitHub repositories (code search). Returns matching code snippets with file paths and line numbers.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The text to search for in GitHub repositories.',
					type: 'string',
				},
				repo: {
					description: 'Optional repository to search within (e.g., "owner/repo").',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGithubTextSearchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			return quizToolResultText(`[GitHub text search results for "${parameters.query}" in ${parameters.repo ?? 'all repos'} would be provided here via GitHub API]`);
		} catch (err) {
			return quizToolResultError(`Failed to search GitHub text: ${String(err)}`);
		}
	}
}

QuizBuiltinToolRegistry.register(new QuizGithubTextSearchTool());

// #endregion
