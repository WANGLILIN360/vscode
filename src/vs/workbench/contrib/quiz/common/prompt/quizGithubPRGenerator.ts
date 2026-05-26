/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/githubPullRequestTitleAndDescriptionGenerator.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizGithubPRGenerator = createDecorator<IQuizGithubPRGenerator>('quizGithubPRGenerator');

export interface IQuizGithubPRGenerator {
	readonly _serviceBrand: undefined;

	/**
	 * Generate a title and description for a GitHub pull request.
	 */
	provideTitleAndDescription(
		context: IQuizPRContext,
		token: CancellationToken,
	): Promise<IQuizPRResult | undefined>;
}

export interface IQuizPRContext {
	commitMessages: string[];
	patches: string[] | IQuizPRPatch[];
	issues?: { reference: string; content: string }[];
	template?: string;
	compareBranch?: string;
}

export interface IQuizPRPatch {
	patch: string;
	fileUri?: string;
	previousFileUri?: string;
}

export interface IQuizPRResult {
	title: string;
	description?: string;
}

/**
 * Parse the raw fetch result into a title and description.
 * Aligned with Copilot's GitHubPullRequestTitleAndDescriptionGenerator.parseFetchResult.
 */
export function quizParsePRFetchResult(value: string, hasTemplate: boolean = false, retry: boolean = true): IQuizPRResult | undefined {
	value = value.trim();
	let workingValue = value;
	let delimiter = '+++';
	const firstIndexOfDelimiter = workingValue.indexOf(delimiter);
	if (firstIndexOfDelimiter === -1) {
		return undefined;
	}

	// adjust delimiter as the model sometimes adds more +s
	while (workingValue.charAt(firstIndexOfDelimiter + delimiter.length) === '+') {
		delimiter += '+';
	}

	const lastIndexOfDelimiter = workingValue.lastIndexOf(delimiter);
	workingValue = workingValue.substring(firstIndexOfDelimiter + delimiter.length, lastIndexOfDelimiter > firstIndexOfDelimiter + delimiter.length ? lastIndexOfDelimiter : undefined).trim().replace(/\++?(\n)\++/, delimiter);
	const splitOnPlus = workingValue.split(delimiter).filter(s => s.trim().length > 0);
	let splitOnLines: string[];
	if (splitOnPlus.length === 1) {
		splitOnLines = splitOnPlus[0].split('\n');
	} else if (splitOnPlus.length > 1) {
		if (hasTemplate) {
			splitOnLines = splitOnPlus;
		} else {
			const descriptionLines = splitOnPlus.slice(1).map(line => line.split('\n')).flat().filter(s => s.trim().length > 0);
			splitOnLines = [splitOnPlus[0], ...descriptionLines];
		}
	} else {
		return undefined;
	}

	let title: string | undefined;
	let description: string | undefined;
	if (splitOnLines.length === 1) {
		title = splitOnLines[0].trim();
		if (retry && value.includes('\n') && (value.split(delimiter).length === 3)) {
			return quizParsePRFetchResult(value + delimiter, hasTemplate, false);
		}
	} else if (splitOnLines.length > 1) {
		title = splitOnLines[0].trim();

		description = '';
		const descriptionLines = splitOnLines.slice(1);
		for (const line of descriptionLines) {
			if (line.includes('commit message')) {
				continue;
			}
			description += `${line.trim()}\n\n`;
		}
	}
	if (title) {
		title = title.replace(/Title\:\s/, '').trim();
		title = title.replace(/^\"(?<title>.+)\"$/, (_match, t) => t);
		if (description && !hasTemplate) {
			description = description.replace(/Description\:\s/, '').trim();
		}
		return { title, description };
	}

	return undefined;
}

/**
 * Null implementation.
 */
export class NullQuizGithubPRGenerator implements IQuizGithubPRGenerator {
	declare readonly _serviceBrand: undefined;

	async provideTitleAndDescription(_context: IQuizPRContext, _token: CancellationToken): Promise<IQuizPRResult | undefined> {
		return undefined;
	}
}
