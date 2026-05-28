/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/ignore/common/ignoreService.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../../base/common/uri.js';

export const QUIZ_HAS_IGNORED_FILES_MESSAGE =
	'\n\n**Note:** Some files were excluded from the context due to content exclusion rules. Click [here](https://docs.github.com/en/copilot/managing-github-copilot-in-your-organization/configuring-content-exclusions-for-github-copilot) to learn more.';

export const IQuizIgnoreService = createDecorator<IQuizIgnoreService>('quizIgnoreService');

/**
 * Service for checking whether files are excluded from Copilot context
 * via .copilotignore, content exclusion rules, or admin settings.
 * Aligned with Copilot's IIgnoreService (platform/ignore/common/ignoreService.ts).
 *
 * Quiz bridges VS Code's workspace file exclusions and Copilot-specific
 * ignore patterns to provide a unified ignore check for tool operations
 * and prompt context gathering.
 */
export interface IQuizIgnoreService {
	readonly _serviceBrand: undefined;

	/** Whether the ignore service is enabled (has any rules loaded) */
	readonly isEnabled: boolean;

	/**
	 * Whether regex-based context exclusions are enabled.
	 * If not enabled, use `asMinimatchPattern()` for glob-style matching.
	 * If enabled, use `isCopilotIgnored()` for per-file regex checks.
	 */
	readonly isRegexExclusionsEnabled: boolean;

	/**
	 * Initialize the ignore service (load .copilotignore, admin exclusions, etc.).
	 * Must be called before using other methods.
	 */
	init(): Promise<void>;

	/**
	 * Check whether a file URI is excluded from Copilot context.
	 * Aligned with Copilot's IIgnoreService.isCopilotIgnored().
	 *
	 * @param file The file URI to check
	 * @param token Optional cancellation token
	 * @returns true if the file should be excluded
	 */
	isCopilotIgnored(file: URI, token?: CancellationToken): Promise<boolean>;

	/**
	 * Get a minimatch-compatible glob pattern representing all exclusion rules.
	 * Useful for pre-filtering file lists without checking each file individually.
	 * Aligned with Copilot's IIgnoreService.asMinimatchPattern().
	 *
	 * @returns A minimatch pattern string, or undefined if no rules apply
	 */
	asMinimatchPattern(): Promise<string | undefined>;

	/**
	 * Dispose of the service and release resources.
	 */
	dispose(): void;
}

// #region NullIgnoreService (aligned with Copilot's NullIgnoreService)

/**
 * Null implementation of IQuizIgnoreService that never excludes any files.
 * Aligned with Copilot's NullIgnoreService.
 */
export class NullQuizIgnoreService implements IQuizIgnoreService {
	declare readonly _serviceBrand: undefined;

	static readonly Instance = new NullQuizIgnoreService();

	dispose(): void { }

	get isEnabled(): boolean {
		return false;
	}

	get isRegexExclusionsEnabled(): boolean {
		return false;
	}

	async init(): Promise<void> { }

	async isCopilotIgnored(_file: URI): Promise<boolean> {
		return false;
	}

	async asMinimatchPattern(): Promise<string | undefined> {
		return undefined;
	}
}

// #endregion

// #region filterIgnoredResources (aligned with Copilot's filterIngoredResources)

/**
 * Filter out ignored resources from a list of URIs.
 * Aligned with Copilot's filterIngoredResources().
 *
 * @param ignoreService The ignore service to check against
 * @param resources The list of URIs to filter
 * @returns The URIs that are not ignored
 */
export async function quizFilterIgnoredResources(ignoreService: IQuizIgnoreService, resources: URI[]): Promise<URI[]> {
	const result: URI[] = [];
	for (const resource of resources) {
		if (!await ignoreService.isCopilotIgnored(resource)) {
			result.push(resource);
		}
	}
	return result;
}

// #endregion
