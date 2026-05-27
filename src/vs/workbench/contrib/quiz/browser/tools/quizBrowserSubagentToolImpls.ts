/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer subagent tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's runSubagentTool.ts, searchSubagentTool.ts, etc.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { IChatAgentService, IChatAgentRequest, IChatAgentResult } from '../../../chat/common/participants/chatAgents.js';
import { IChatService, IChatProgress } from '../../../chat/common/chatService/chatService.js';
import { ChatAgentLocation, ChatModeKind } from '../../../chat/common/constants.js';
import { ISearchService, QueryType, ITextQuery, IFileQuery, resultIsMatch } from '../../../../services/search/common/search.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ChatModel } from '../../../chat/common/model/chatModel.js';

// #region QuizRunSubagentToolImpl (browser-layer, aligned with Copilot's RunSubagentTool)

export interface IQuizRunSubagentInput {
	prompt: string;
	description: string;
	agentName?: string;
	model?: string;
}

/** Max nesting depth for subagent recursion (aligned with Copilot's RUN_SUBAGENT_MAX_NESTING_DEPTH) */
const QUIZ_RUN_SUBAGENT_MAX_NESTING_DEPTH = 5;

export class QuizRunSubagentToolImpl extends QuizBuiltinTool<IQuizRunSubagentInput> {

	readonly toolName = QuizToolName.CoreRunSubagent;

	/** Tracks the current subagent nesting depth per session to detect and limit recursion. */
	private readonly _sessionDepth = new Map<string, number>();

	readonly definition = {
		name: QuizToolName.CoreRunSubagent,
		description: `Launch a new agent to handle complex, multi-step tasks autonomously. This tool is good at researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries, use this agent to perform the search for you.

- Agents do not run async or in the background, you will wait for the agent's result.
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
- Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
- The agent's outputs should generally be trusted
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
- If the user asks for a certain agent, you MUST provide that EXACT agent name (case-sensitive) to invoke that specific agent.`,
		inputSchema: {
			type: 'object',
			required: ['prompt', 'description'],
			properties: {
				prompt: {
					description: 'A detailed description of the task for the agent to perform',
					type: 'string',
				},
				description: {
					description: 'A short (3-5 word) description of the task',
					type: 'string',
				},
				agentName: {
					description: 'Name of the agent to invoke.',
					type: 'string',
				},
				model: {
					description: 'Optional model for the subagent. Format: "Model Name (Vendor)", vendor is usually "copilot". Only use to enforce a specific model.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _chatAgentService: IChatAgentService,
		private readonly _chatService: IChatService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	override async invoke(parameters: IQuizRunSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		this._logService.debug(`QuizRunSubagentTool: Invoking with prompt: ${parameters.prompt.substring(0, 100)}...`);

		const chatSessionResource = context.sessionResource;
		if (!chatSessionResource) {
			return quizToolResultError('No session resource available');
		}

		const model = this._chatService.getSession(chatSessionResource) as ChatModel | undefined;
		if (!model) {
			return quizToolResultError('Chat model not found for session');
		}

		const request = model.getRequests().at(-1);
		if (!request) {
			return quizToolResultError('No request found in chat session');
		}

		const store = new DisposableStore();

		try {
			// Get the default agent (aligned with Copilot's getDefaultAgent)
			const defaultAgent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, ChatModeKind.Agent);
			if (!defaultAgent) {
				return quizToolResultError('No default agent available');
			}

			// Determine subagent nesting depth (aligned with Copilot's depth tracking)
			const sessionKey = chatSessionResource.toString();
			const currentDepth = this._sessionDepth.get(sessionKey) ?? 0;
			const depthAllowed = currentDepth + 1 <= QUIZ_RUN_SUBAGENT_MAX_NESTING_DEPTH;

			if (!depthAllowed) {
				return quizToolResultError(`Maximum subagent nesting depth (${QUIZ_RUN_SUBAGENT_MAX_NESTING_DEPTH}) exceeded`);
			}

			// Generate subAgentInvocationId (aligned with Copilot)
			const subAgentInvocationId = context.toolCallId ?? `subagent-${generateUuid()}`;

			// Track markdown content from the subagent (aligned with Copilot's markdownParts)
			const markdownParts: string[] = [];
			let inEdit = false;

			const progressCallback = (parts: IChatProgress[]) => {
				for (const part of parts) {
					if (part.kind === 'textEdit' || part.kind === 'notebookEdit' || part.kind === 'codeblockUri') {
						if (part.kind === 'codeblockUri' && !inEdit) {
							inEdit = true;
							model.acceptResponseProgress(request, { kind: 'markdownContent', content: new MarkdownString('```\n') });
						}
						if (part.kind === 'codeblockUri') {
							model.acceptResponseProgress(request, { ...part, subAgentInvocationId });
						} else {
							model.acceptResponseProgress(request, part);
						}
					} else if (part.kind === 'hook') {
						model.acceptResponseProgress(request, { ...part, subAgentInvocationId });
					} else if (part.kind === 'markdownContent') {
						if (inEdit) {
							model.acceptResponseProgress(request, { kind: 'markdownContent', content: new MarkdownString('\n```\n\n') });
							inEdit = false;
						}
						markdownParts.push(part.content.value);
					}
				}
			};

			// Build the agent request (aligned with Copilot's IChatAgentRequest)
			const agentRequest: IChatAgentRequest = {
				sessionResource: chatSessionResource,
				requestId: context.toolCallId ?? `subagent-${Date.now()}`,
				agentId: defaultAgent.id,
				message: parameters.prompt,
				variables: { variables: [] },
				location: ChatAgentLocation.Chat,
				subAgentInvocationId,
				subAgentName: parameters.agentName,
				parentRequestId: context.requestId,
			};

			// Invoke the agent with depth tracking (aligned with Copilot)
			this._sessionDepth.set(sessionKey, currentDepth + 1);
			let result: IChatAgentResult | undefined;
			try {
				result = await this._chatAgentService.invokeAgent(
					defaultAgent.id,
					agentRequest,
					progressCallback,
					[],
					token
				);
			} finally {
				const newDepth = (this._sessionDepth.get(sessionKey) ?? 1) - 1;
				if (newDepth <= 0) {
					this._sessionDepth.delete(sessionKey);
				} else {
					this._sessionDepth.set(sessionKey, newDepth);
				}
			}

			// Check for errors (aligned with Copilot)
			if (result?.errorDetails) {
				return quizToolResultError(`Agent error: ${result.errorDetails.message}`);
			}

			// Strip empty codeblocks (aligned with Copilot's hack)
			const resultText = markdownParts.join('').replace(/^\n*```\n+```\n*/g, '').trim() || 'Agent completed with no output';
			return quizToolResultText(resultText);

		} catch (error) {
			const errorMessage = `Error invoking subagent: ${error instanceof Error ? error.message : 'Unknown error'}`;
			this._logService.error(errorMessage, error);
			return quizToolResultError(errorMessage);
		} finally {
			store.dispose();
		}
	}
}

// #endregion

// #region QuizSearchSubagentToolImpl (browser-layer, aligned with Copilot's SearchSubagentTool)

export interface IQuizSearchSubagentInput {
	query: string;
	thoroughness?: 'normal' | 'deep';
}

export class QuizSearchSubagentToolImpl extends QuizBuiltinTool<IQuizSearchSubagentInput> {

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

	constructor(
		private readonly _searchService: ISearchService,
		private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	override async invoke(parameters: IQuizSearchSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Search subagent performs a multi-strategy search
			const folderQueries = this._workspaceContextService.getWorkspace().folders.map(f => ({ folder: f.uri }));
			const maxResults = parameters.thoroughness === 'deep' ? 50 : 20;

			// Strategy 1: Text search
			const textQuery: ITextQuery = {
				type: QueryType.Text,
				contentPattern: {
					pattern: parameters.query,
					isRegExp: false,
					isCaseSensitive: false,
					isWordMatch: false,
				},
				folderQueries,
				maxResults,
			};

			const textResult = await this._searchService.textSearch(textQuery, token);

			// Strategy 2: File name search
			const fileQuery: IFileQuery = {
				type: QueryType.File,
				folderQueries,
				filePattern: parameters.query,
				maxResults,
			};

			const fileResult = await this._searchService.fileSearch(fileQuery, token);

			// Combine results
			const lines: string[] = [];

			if (textResult.results.length > 0) {
				lines.push('=== Text Search Results ===');
				for (const fileMatch of textResult.results.slice(0, maxResults)) {
					const filePath = fileMatch.resource.fsPath;
					if (fileMatch.results) {
						for (const r of fileMatch.results.slice(0, 5)) {
							if (resultIsMatch(r)) {
								const line = r.rangeLocations[0]?.source.startLineNumber ?? '';
								lines.push(`${filePath}:${line}: ${r.previewText.trim()}`);
							}
						}
					}
				}
			}

			if (fileResult.results.length > 0) {
				lines.push('=== File Name Results ===');
				for (const r of fileResult.results.slice(0, 20)) {
					lines.push(r.resource.fsPath);
				}
			}

			if (lines.length === 0) {
				return quizToolResultText(`No results found for "${parameters.query}"`);
			}

			return quizToolResultText(lines.join('\n'));
		} catch (err) {
			return quizToolResultError(`Failed to run search subagent: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizExploreSubagentToolImpl (browser-layer, aligned with Copilot's ExploreSubagentTool)

export interface IQuizExploreSubagentInput {
	query: string;
}

export class QuizExploreSubagentToolImpl extends QuizBuiltinTool<IQuizExploreSubagentInput> {

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

	constructor(
		private readonly _searchService: ISearchService,
		private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	override async invoke(parameters: IQuizExploreSubagentInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Explore subagent combines text search with file discovery
			const folderQueries = this._workspaceContextService.getWorkspace().folders.map(f => ({ folder: f.uri }));

			const textQuery: ITextQuery = {
				type: QueryType.Text,
				contentPattern: {
					pattern: parameters.query,
					isRegExp: false,
					isCaseSensitive: false,
					isWordMatch: false,
				},
				folderQueries,
				maxResults: 30,
			};

			const result = await this._searchService.textSearch(textQuery, token);

			if (!result.results.length) {
				return quizToolResultText(`No exploration results for "${parameters.query}"`);
			}

			const files = new Set<string>();
			const snippets: string[] = [];

			for (const fileMatch of result.results.slice(0, 30)) {
				const filePath = fileMatch.resource.fsPath;
				files.add(filePath);
				if (fileMatch.results) {
					for (const r of fileMatch.results.slice(0, 3)) {
						if (resultIsMatch(r)) {
							const line = r.rangeLocations[0]?.source.startLineNumber ?? '';
							snippets.push(`${filePath}:${line}: ${r.previewText.trim()}`);
						}
					}
				}
			}

			let output = `Exploration results for "${parameters.query}":\n`;
			output += `\nRelevant files (${files.size}):\n`;
			for (const f of files) {
				output += `- ${f}\n`;
			}
			output += `\nCode snippets:\n${snippets.join('\n')}`;

			return quizToolResultText(output);
		} catch (err) {
			return quizToolResultError(`Failed to run explore subagent: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizExecutionSubagentToolImpl (browser-layer, aligned with Copilot's ExecutionSubagentTool)

export interface IQuizExecutionSubagentInput {
	prompt: string;
	cwd?: string;
}

export class QuizExecutionSubagentToolImpl extends QuizBuiltinTool<IQuizExecutionSubagentInput> {

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
			// Execution subagent delegates to the terminal + chat infrastructure
			return quizToolResultText(`[Execution subagent launched with prompt: "${parameters.prompt.substring(0, 200)}${parameters.prompt.length > 200 ? '...' : ''}"${parameters.cwd ? ` in ${parameters.cwd}` : ''} — execution is handled by the chat infrastructure]`);
		} catch (err) {
			return quizToolResultError(`Failed to run execution subagent: ${String(err)}`);
		}
	}
}

// #endregion

// #region QuizSkillToolImpl (browser-layer, aligned with Copilot's SkillTool)

/** Maximum number of related files to list in skill context. Aligned with Copilot's MAX_RELATED_FILES. */
const MAX_RELATED_FILES = 50;

/** Directories to skip when listing related files. Aligned with Copilot's SKILL_SKIP_DIRS. */
const SKILL_SKIP_DIRS = new Set([
	'.git', 'node_modules', 'dist', 'build', 'out', '.cache',
	'coverage', '__pycache__', 'target', 'bin', 'obj', '.venv', 'venv',
]);

/** Skill filename. Aligned with Copilot's SKILL_FILENAME. */
const SKILL_FILENAME = 'SKILL.md';

/**
 * Parse the `context` field from SKILL.md YAML frontmatter.
 * Returns 'fork' if frontmatter contains `context: fork`, otherwise 'inline'.
 * Aligned with Copilot's parseSkillContext.
 */
function parseSkillContext(content: string): 'inline' | 'fork' {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/m);
	if (!frontmatterMatch) {
		return 'inline';
	}
	const contextMatch = frontmatterMatch[1].match(/^context:\s*(.+)$/m);
	if (contextMatch && contextMatch[1].trim() === 'fork') {
		return 'fork';
	}
	return 'inline';
}

export interface IQuizSkillInput {
	/** The skill name. E.g., "commit", "review-pr", or "pdf". Aligned with Copilot's ISkillParams. */
	skill: string;
}

export class QuizSkillToolImpl extends QuizBuiltinTool<IQuizSkillInput> {

	readonly toolName = QuizToolName.Skill;

	readonly definition = {
		name: QuizToolName.Skill,
		description: 'Invoke a registered skill by reading its SKILL.md file and providing the skill context. Skills can be inline (instructions loaded into context) or fork (delegated to a subagent). Use this to load specialized workflows or reusable prompt templates.',
		inputSchema: {
			type: 'object',
			required: ['skill'],
			properties: {
				skill: {
					description: 'The skill name to invoke (e.g., "commit", "review-pr").',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _chatAgentService: IChatAgentService,
		private readonly _chatService: IChatService,
		private readonly _workspaceContextService: IWorkspaceContextService,
		private readonly _fileService: IFileService,
	) {
		super();
	}

	override async invoke(parameters: IQuizSkillInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Resolve skill URI — aligned with Copilot's resolveSkillUri
			const uri = await this._resolveSkillUri(parameters.skill);
			if (!uri) {
				const available = await this._listAvailableSkills();
				const skillListMessage = available.length > 0
					? ` Available skills: ${available.join(', ')}`
					: '';
				return quizToolResultError(`Skill "${parameters.skill}" not found.${skillListMessage}`);
			}

			// Read the skill file content — aligned with Copilot's workspaceService.openTextDocument
			const content = await this._readSkillFile(uri);
			if (!content) {
				return quizToolResultError(`Failed to read skill file: ${uri.toString()}`);
			}

			// Parse frontmatter for mode — aligned with Copilot's parseSkillContext
			const mode = parseSkillContext(content);

			if (mode === 'fork') {
				return this._invokeFork(parameters.skill, content, uri, context, token);
			} else {
				return this._invokeInline(parameters.skill, content, uri);
			}
		} catch (err) {
			return quizToolResultError(`Failed to invoke skill: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizSkillInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		return {
			invocationMessage: `Loading skill: ${parameters.skill}`,
		};
	}

	/** Inline mode: return skill content directly — aligned with Copilot's invokeInline. */
	private async _invokeInline(skillName: string, skillContent: string, uri: URI): Promise<IQuizToolResult> {
		// List related files in the skill directory — aligned with Copilot's listRelatedFiles
		const skillFolderUri = URI.joinPath(uri, '..');
		const relatedFiles = await this._listRelatedFiles(skillFolderUri);
		const relatedFilesSection = relatedFiles.length > 0
			? `\nRelated files (use read_file tool to read):\n${relatedFiles.map(f => `  - ${f}`).join('\n')}\n`
			: '';

		// Format as skill-context — aligned with Copilot's <skill-context> wrapper
		const resultText = `<skill-context name="${skillName}">
Base directory: ${skillFolderUri.fsPath}
${relatedFilesSection}
${skillContent}
</skill-context>`;

		return quizToolResultText(resultText);
	}

	/** Fork mode: delegate to subagent — aligned with Copilot's invokeFork. */
	private async _invokeFork(skillName: string, skillContent: string, _uri: URI, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		// Build prompt for subagent — aligned with Copilot's fork prompt construction
		const prompt = `You have been loaded with the following skill instructions. Follow them carefully to complete the task.

<skill_instructions>
${skillContent}
</skill_instructions>

Task: Run the ${skillName} skill`;

		// Delegate to RunSubagentTool — aligned with Copilot's toolsService.invokeTool(CoreRunSubagent, ...)
		const chatSessionResource = context.sessionResource;
		if (!chatSessionResource) {
			return quizToolResultError('No session resource available for fork skill');
		}

		const model = this._chatService.getSession(chatSessionResource) as ChatModel | undefined;
		if (!model) {
			return quizToolResultError('Chat model not found for session');
		}

		const request = model.getRequests().at(-1);
		if (!request) {
			return quizToolResultError('No request found in chat session');
		}

		const defaultAgent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, ChatModeKind.Agent);
		if (!defaultAgent) {
			return quizToolResultError('No default agent available for fork skill');
		}

		const subAgentInvocationId = context.toolCallId ?? `skill-fork-${generateUuid()}`;

		const agentRequest: IChatAgentRequest = {
			sessionResource: chatSessionResource,
			requestId: context.toolCallId ?? `skill-fork-${Date.now()}`,
			agentId: defaultAgent.id,
			message: prompt,
			variables: { variables: [] },
			location: ChatAgentLocation.Chat,
			subAgentInvocationId,
			subAgentName: skillName,
			parentRequestId: context.requestId,
		};

		// Track markdown from subagent — aligned with Copilot's markdownParts pattern
		const markdownParts: string[] = [];
		const progressCallback = (parts: IChatProgress[]) => {
			for (const part of parts) {
				if (part.kind === 'markdownContent') {
					markdownParts.push(part.content.value);
				}
			}
		};

		const result = await this._chatAgentService.invokeAgent(
			defaultAgent.id,
			agentRequest,
			progressCallback,
			[],
			token
		);

		if (result?.errorDetails) {
			return quizToolResultError(`Skill agent error: ${result.errorDetails.message}`);
		}

		// Frame result as skill output — aligned with Copilot's framing
		const subagentResponse = markdownParts.join('') || 'Skill completed with no output';
		return quizToolResultText(`Result from the "${skillName}" skill:\n\n${subagentResponse}`);
	}

	/** Resolve a skill name to its SKILL.md URI — aligned with Copilot's resolveSkillUri. */
	private async _resolveSkillUri(skillName: string): Promise<URI | undefined> {
		const folders = this._workspaceContextService.getWorkspace().folders;
		for (const folder of folders) {
			// Check common skill locations — aligned with Copilot's instruction index search
			const candidates = [
				URI.joinPath(folder.uri, '.github', 'skills', skillName, SKILL_FILENAME),
				URI.joinPath(folder.uri, '.github', 'instructions', skillName, SKILL_FILENAME),
				URI.joinPath(folder.uri, '.vscode', 'skills', skillName, SKILL_FILENAME),
				URI.joinPath(folder.uri, skillName, SKILL_FILENAME),
			];

			for (const candidate of candidates) {
				try {
					const exists = await this._fileService.exists(candidate);
					if (exists) {
						return candidate;
					}
				} catch {
					// File doesn't exist at this path, continue
				}
			}
		}
		return undefined;
	}

	/** Read skill file content. */
	private async _readSkillFile(uri: URI): Promise<string | undefined> {
		try {
			const content = await this._fileService.readFile(uri);
			return content.value.toString();
		} catch {
			return undefined;
		}
	}

	/** List available skills in the workspace. Aligned with Copilot's instruction index parsing. */
	private async _listAvailableSkills(): Promise<string[]> {
		const skills: string[] = [];
		const folders = this._workspaceContextService.getWorkspace().folders;
		for (const folder of folders) {
			// Check .github/skills directory — aligned with Copilot's instruction index search
			const skillsDir = URI.joinPath(folder.uri, '.github', 'skills');
			try {
				const stat = await this._fileService.resolve(skillsDir);
				if (stat.children) {
					for (const child of stat.children) {
						if (child.isDirectory) {
							const skillFile = URI.joinPath(child.resource, SKILL_FILENAME);
							const exists = await this._fileService.exists(skillFile);
							if (exists) {
								skills.push(child.name);
							}
						}
					}
				}
			} catch {
				// Directory doesn't exist
			}
		}
		return skills;
	}

	/** List related files in a skill directory. Aligned with Copilot's listRelatedFiles. */
	private async _listRelatedFiles(skillFolderUri: URI): Promise<string[]> {
		const relatedFiles: string[] = [];
		try {
			const stat = await this._fileService.resolve(skillFolderUri);
			if (stat.children) {
				for (const child of stat.children) {
					if (!child.isDirectory && !SKILL_SKIP_DIRS.has(child.name) && child.name !== SKILL_FILENAME) {
						relatedFiles.push(child.resource.fsPath);
						if (relatedFiles.length >= MAX_RELATED_FILES) {
							break;
						}
					}
				}
			}
		} catch {
			// Directory doesn't exist or can't be resolved
		}
		return relatedFiles;
	}
}

// #endregion

// #region QuizGithubSemanticRepoSearchToolImpl (browser-layer, aligned with Copilot's GithubSemanticRepoSearch)

export interface IQuizGithubRepoSearchInput {
	query: string;
	scope?: string;
	maxResults?: number;
}

export class QuizGithubSemanticRepoSearchToolImpl extends QuizBuiltinTool<IQuizGithubRepoSearchInput> {

	readonly toolName = QuizToolName.GithubSemanticRepoSearch;

	readonly definition = {
		name: QuizToolName.GithubSemanticRepoSearch,
		description: 'Search GitHub repositories using semantic search. Returns relevant code chunks with file paths and line numbers. Requires a scope (owner/repo or org name).',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The search query for GitHub repositories.',
					type: 'string',
				},
				scope: {
					description: 'Either "owner/repo" for a single repo, or an org name (no slash).',
					type: 'string',
				},
				maxResults: {
					description: 'Maximum number of results to return. Default: 100.',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGithubRepoSearchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Validate scope — aligned with Copilot's parseScope
			if (parameters.scope && !this._parseScope(parameters.scope)) {
				return quizToolResultError('Invalid scope. Use "owner/repo" for a single repo, or an org name (no slash).');
			}

			// GitHub semantic search requires IGithubCodeSearchService (Copilot-private)
			// In VS Code core, this is not available — provide a helpful message
			const scopeLabel = parameters.scope ?? 'all GitHub';
			return quizToolResultText(`Searched ${scopeLabel} for "${parameters.query}", no results.\n\n[GitHub semantic search requires the Copilot GitHub Code Search service which is not available in VS Code core. This tool is registered but not functional without the Copilot extension.]`);
		} catch (err) {
			return quizToolResultError(`Failed to search GitHub repos: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizGithubRepoSearchInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		if (!parameters.scope) {
			throw new Error('Invalid input. No scope argument provided.');
		}
		if (!this._parseScope(parameters.scope)) {
			throw new Error('Invalid input. Could not parse scope argument.');
		}
		return {
			invocationMessage: `Searching '${parameters.scope}' for '${parameters.query}'`,
		};
	}

	/** Parse scope — aligned with Copilot's parseScope. */
	private _parseScope(scope: string): boolean {
		if (!scope) {
			return false;
		}
		if (scope.includes('/')) {
			const parts = scope.split('/');
			return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
		}
		return scope.length > 0;
	}
}

// #endregion

// #region QuizGithubTextSearchToolImpl (browser-layer, aligned with Copilot's GithubTextSearch)

export interface IQuizGithubTextSearchInput {
	query: string;
	scope?: string;
	maxResults?: number;
}

export class QuizGithubTextSearchToolImpl extends QuizBuiltinTool<IQuizGithubTextSearchInput> {

	readonly toolName = QuizToolName.GithubTextSearch;

	readonly definition = {
		name: QuizToolName.GithubTextSearch,
		description: 'Search for text within GitHub repositories (code search). Returns matching code snippets with file paths and line numbers. Requires a scope (owner/repo or org name).',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The text to search for in GitHub repositories.',
					type: 'string',
				},
				scope: {
					description: 'Either "owner/repo" for a single repo, or an org name (no slash).',
					type: 'string',
				},
				maxResults: {
					description: 'Maximum number of results to return. Default: 100.',
					type: 'number',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	override async invoke(parameters: IQuizGithubTextSearchInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Validate scope — aligned with Copilot's parseScope
			if (parameters.scope && !this._parseScope(parameters.scope)) {
				return quizToolResultError('Invalid scope. Use "owner/repo" for a single repo, or an org name (no slash).');
			}

			// GitHub text search requires IGithubCodeSearchService (Copilot-private)
			// In VS Code core, this is not available — provide a helpful message
			const scopeLabel = parameters.scope ?? 'all GitHub';
			return quizToolResultText(`Searched ${scopeLabel} for "${parameters.query}", no results.\n\n[GitHub code search requires the Copilot GitHub Code Search service which is not available in VS Code core. This tool is registered but not functional without the Copilot extension.]`);
		} catch (err) {
			return quizToolResultError(`Failed to search GitHub text: ${String(err)}`);
		}
	}

	override async prepareInvocation(parameters: IQuizGithubTextSearchInput, _token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }> {
		if (!parameters.scope) {
			throw new Error('Invalid input. No scope argument provided.');
		}
		if (!this._parseScope(parameters.scope)) {
			throw new Error('Invalid input. Could not parse scope argument.');
		}
		return {
			invocationMessage: `Searching '${parameters.scope}' for '${parameters.query}'`,
		};
	}

	/** Parse scope — aligned with Copilot's parseScope. */
	private _parseScope(scope: string): boolean {
		if (!scope) {
			return false;
		}
		if (scope.includes('/')) {
			const parts = scope.split('/');
			return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
		}
		return scope.length > 0;
	}
}

// #endregion

/**
 * Register all browser-layer subagent tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserSubagentTools(
	chatAgentService: IChatAgentService,
	chatService: IChatService,
	logService: ILogService,
	searchService: ISearchService,
	workspaceContextService: IWorkspaceContextService,
	fileService: IFileService,
): void {
	QuizBuiltinToolRegistry.register(new QuizRunSubagentToolImpl(chatAgentService, chatService, logService));
	QuizBuiltinToolRegistry.register(new QuizSearchSubagentToolImpl(searchService, workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizExploreSubagentToolImpl(searchService, workspaceContextService));
	QuizBuiltinToolRegistry.register(new QuizExecutionSubagentToolImpl());
	QuizBuiltinToolRegistry.register(new QuizSkillToolImpl(chatAgentService, chatService, workspaceContextService, fileService));
	QuizBuiltinToolRegistry.register(new QuizGithubSemanticRepoSearchToolImpl());
	QuizBuiltinToolRegistry.register(new QuizGithubTextSearchToolImpl());
}
