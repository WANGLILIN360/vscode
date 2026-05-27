/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Browser-layer search tool implementations using real VS Code services.
// These override the common-layer stubs with actual service-backed logic.
// Aligned with Copilot's tools/node/findTextInFilesTool.tsx, findFilesTool.tsx

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IQuizToolResult, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolInvocationContext } from '../../common/tools/quizToolsService.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinTool, quizToolResultText, quizToolResultError, QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';
import { ISearchService, ITextQuery, IFileMatch, isFileMatch, ITextSearchMatch, QueryType } from '../../../../services/search/common/search.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';

// #region QuizFindTextInFilesToolImpl (browser-layer, aligned with Copilot's FindTextInFilesTool)

export interface IQuizFindTextInFilesInput {
	query: string;
	filePattern?: string;
	includeUris?: string[];
}

export class QuizFindTextInFilesToolImpl extends QuizBuiltinTool<IQuizFindTextInFilesInput> {

	readonly toolName = QuizToolName.FindTextInFiles;

	readonly definition = {
		name: QuizToolName.FindTextInFiles,
		description: 'Search for text in files across the workspace. Returns matching file paths, line numbers, and surrounding context.',
		inputSchema: {
			type: 'object',
			required: ['query'],
			properties: {
				query: {
					description: 'The text to search for.',
					type: 'string',
				},
				filePattern: {
					description: 'Optional glob pattern to filter files (e.g., "*.ts").',
					type: 'string',
				},
				includeUris: {
					description: 'Optional list of file URIs to search within.',
					type: 'array',
					items: { type: 'string' },
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

	override async invoke(parameters: IQuizFindTextInFilesInput, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult> {
		try {
			const folderQueries = this._workspaceContextService.getWorkspace().folders.map(f => ({ folder: f.uri }));

			const query: ITextQuery = {
				type: QueryType.Text,
				contentPattern: {
					pattern: parameters.query,
					isRegExp: false,
					isCaseSensitive: false,
					isWordMatch: false,
				},
				folderQueries,
				includePattern: parameters.filePattern ? { [parameters.filePattern]: true } : undefined,
				maxResults: 100,
			};

			const result = await this._searchService.textSearch(query, token);

			if (!result.results.length) {
				return quizToolResultText(`No results found for "${parameters.query}"`);
			}

			const lines: string[] = [];
			for (const item of result.results) {
				if (isFileMatch(item)) {
					const fileMatch = item as IFileMatch;
					const filePath = fileMatch.resource.fsPath;
					if (fileMatch.results) {
						for (const r of fileMatch.results) {
							const textMatch = r as ITextSearchMatch;
							if (textMatch.previewText) {
								lines.push(`${filePath}: ${textMatch.previewText.trim()}`);
							}
						}
					}
				}
			}

			const summary = lines.length > 50
				? lines.slice(0, 50).join('\n') + `\n\n... and ${lines.length - 50} more results`
				: lines.join('\n');

			return quizToolResultText(summary);
		} catch (err) {
			return quizToolResultError(`Failed to search text: ${String(err)}`);
		}
	}
}

// #endregion

/**
 * Register all browser-layer search tool implementations, overriding the
 * common-layer stubs. This should be called during service initialization.
 */
export function registerQuizBrowserSearchTools(
	searchService: ISearchService,
	workspaceContextService: IWorkspaceContextService,
): void {
	QuizBuiltinToolRegistry.register(new QuizFindTextInFilesToolImpl(searchService, workspaceContextService));
}
