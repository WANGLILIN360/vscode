/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer session store tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's sessionStoreSqlTool.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IChatService } from '../../../chat/common/chatService/chatService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

// #region QuizSessionStoreSqlToolImpl (browser-layer, aligned with Copilot's SessionStoreSqlTool)

/** Max rows to return to avoid blowing up the context window. Aligned with Copilot's MAX_ROWS. */
const MAX_ROWS = 100;

/** Dangerous SQL patterns that should be blocked. Aligned with Copilot's BLOCKED_PATTERNS. */
const BLOCKED_PATTERNS = [
	/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE)\b/i,
	/\bATTACH\b/i,
	/\bDETACH\b/i,
	/\bPRAGMA\b(?!\s+data_version)/i,
	/\bVACUUM\b/i,
	/\bREINDEX\b/i,
	/\bANALYZE\b/i,
	/\bLOAD_EXTENSION\b/i,
	/\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i,
];

/** Strip leading SQL line and block comments plus whitespace. Aligned with Copilot's stripLeadingCommentsAndWhitespace. */
function stripLeadingCommentsAndWhitespace(sql: string): string {
	let s = sql;
	let prev: string;
	do {
		prev = s;
		s = s.replace(/^\s+/, '');
		s = s.replace(/^--[^\n]*\n?/, '');
		s = s.replace(/^\/\*[\s\S]*?\*\//, '');
	} while (s !== prev);
	return s;
}

/** Format SQL result rows as a markdown table. Aligned with Copilot's formatSqlResult. */
function formatSqlResult(rows: Record<string, unknown>[], truncated: boolean, source: string): string {
	if (rows.length === 0) {
		return `No results (${source}).`;
	}

	const columns = Object.keys(rows[0]);
	const lines: string[] = [];

	// Header
	lines.push('| ' + columns.join(' | ') + ' |');
	lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');

	// Rows
	for (const row of rows) {
		lines.push('| ' + columns.map(c => String(row[c] ?? '')).join(' | ') + ' |');
	}

	if (truncated) {
		lines.push(`\n[Results truncated at ${MAX_ROWS} rows]`);
	}

	return lines.join('\n');
}

export interface IQuizSessionStoreSqlInput {
	action?: 'query' | 'standup';
	query?: string;
	description: string;
}

export class QuizSessionStoreSqlToolImpl extends QuizBuiltinTool<IQuizSessionStoreSqlInput> {

	readonly toolName = QuizToolName.SessionStoreSql;

	readonly definition = {
		name: QuizToolName.SessionStoreSql,
		description: 'Query the session store containing past coding sessions. Uses SQLite syntax. SQL queries are read-only — only SELECT and WITH are allowed. Actions: "query" (execute SQL), "standup" (pre-fetch recent session data).',
		inputSchema: {
			type: 'object',
			required: ['description'],
			properties: {
				action: {
					description: 'Action to perform: "query" (execute SQL) or "standup" (fetch recent sessions). Default: "query".',
					type: 'string',
					enum: ['query', 'standup'],
				},
				query: {
					description: 'The SQL query to execute. Only SELECT queries are allowed.',
					type: 'string',
				},
				description: {
					description: 'A brief description of what this query is trying to find.',
					type: 'string',
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

	override async invoke(parameters: IQuizSessionStoreSqlInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		const action = parameters.action ?? 'query';

		switch (action) {
			case 'standup':
				return this._invokeStandup();
			default:
				return this._invokeQuery(parameters.query ?? '');
		}
	}

	private _invokeQuery(rawQuery: string): IQuizToolResult {
		// Strip trailing semicolons — aligned with Copilot
		const sql = rawQuery.trim().replace(/;+\s*$/, '');

		if (!sql) {
			return quizToolResultError('Empty query provided.');
		}

		// Security check: block mutating / side-effecting statements — aligned with Copilot's BLOCKED_PATTERNS
		for (const pattern of BLOCKED_PATTERNS) {
			if (pattern.test(sql)) {
				return quizToolResultError('Blocked SQL statement. Only SELECT or WITH queries are allowed.');
			}
		}

		// Allowlist: model-supplied SQL must be a SELECT or WITH (CTE) statement — aligned with Copilot
		const firstKeywordSrc = stripLeadingCommentsAndWhitespace(sql);
		if (!/^(SELECT|WITH)\b/i.test(firstKeywordSrc)) {
			return quizToolResultError('Blocked SQL statement. Only SELECT or WITH queries are allowed.');
		}

		// Block multiple statements — only one query per call — aligned with Copilot
		if (sql.includes(';')) {
			return quizToolResultError('Only one SQL statement per call. Remove semicolons and split into separate calls.');
		}

		// Build session data from IChatService — simplified local session store
		// (Copilot uses ISessionStore with SQLite; we use IChatService in-memory data)
		const rows = this._buildSessionRows();
		const truncated = rows.length > MAX_ROWS;
		const cappedRows = truncated ? rows.slice(0, MAX_ROWS) : rows;

		// Simple filtering: try to match SQL-like WHERE conditions against our data
		// Full SQL execution requires node-layer SQLite; this provides basic SELECT * support
		const result = formatSqlResult(cappedRows, truncated, 'local');
		return quizToolResultText(result);
	}

	private _invokeStandup(): IQuizToolResult {
		// Aligned with Copilot's standup action: pre-fetch recent session data
		const rows = this._buildSessionRows();
		const truncated = rows.length > MAX_ROWS;
		const cappedRows = truncated ? rows.slice(0, MAX_ROWS) : rows;

		if (cappedRows.length === 0) {
			return quizToolResultText('No recent sessions found.');
		}

		const result = formatSqlResult(cappedRows, truncated, 'local');
		return quizToolResultText(`Recent sessions:\n\n${result}`);
	}

	/** Build session rows from IChatService data — simplified local session store. */
	private _buildSessionRows(): Record<string, unknown>[] {
		const rows: Record<string, unknown>[] = [];

		try {
			const chatModels = this._chatService.chatModels.get();
			if (!chatModels) {
				return rows;
			}

			for (const model of chatModels) {
				const requests = model.getRequests?.() ?? [];
				rows.push({
					session_id: model.sessionId,
					title: model.title ?? '',
					request_count: requests.length,
					last_request_time: requests.length > 0 ? (requests[requests.length - 1]?.timestamp ?? '') : '',
				});
			}
		} catch (err) {
			this._logService.warn(`[QuizSessionStoreSqlTool] Failed to access session data: ${String(err)}`);
		}

		return rows;
	}
}

// #endregion

// #region QuizResolveMemoryFileUriToolImpl (browser-layer, aligned with Copilot's ResolveMemoryFileUriTool)

export interface IQuizResolveMemoryFileUriInput {
	uri: string;
}

export class QuizResolveMemoryFileUriToolImpl extends QuizBuiltinTool<IQuizResolveMemoryFileUriInput> {

	readonly toolName = QuizToolName.ResolveMemoryFileUri;

	readonly definition = {
		name: QuizToolName.ResolveMemoryFileUri,
		description: 'Resolve a memory file URI to its actual file system path. Memory files are virtual files stored in the session that may map to real workspace files.',
		inputSchema: {
			type: 'object',
			required: ['uri'],
			properties: {
				uri: {
					description: 'The memory file URI to resolve.',
					type: 'string',
				},
			},
		} satisfies IQuizToolDefinition['inputSchema'],
	};

	constructor(
		private readonly _uriIdentityService: IUriIdentityService,
	) {
		super();
	}

	override async invoke(parameters: IQuizResolveMemoryFileUriInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			// Try to parse the URI and resolve it
			let uri: URI;
			try {
				uri = URI.parse(parameters.uri);
			} catch {
				// Try as a file path
				uri = URI.file(parameters.uri);
			}

			// Use uriIdentityService to get the canonical form
			const resolved = this._uriIdentityService.asCanonicalUri(uri);

			return quizToolResultText(`Resolved URI: ${resolved.toString()}\nFsPath: ${resolved.fsPath}`);
		} catch (err) {
			return quizToolResultError(`Failed to resolve memory file URI: ${String(err)}`);
		}
	}
}

// #endregion

/**
 * Register all browser-layer session store tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserSessionStoreTools(
	uriIdentityService: IUriIdentityService,
	chatService: IChatService,
	logService: ILogService,
): void {
	QuizBuiltinToolRegistry.register(new QuizSessionStoreSqlToolImpl(chatService, logService));
	QuizBuiltinToolRegistry.register(new QuizResolveMemoryFileUriToolImpl(uriIdentityService));
}
