/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/gitCommitMessageGenerator.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizGitCommitMessageGenerator = createDecorator<IQuizGitCommitMessageGenerator>('quizGitCommitMessageGenerator');

export interface IQuizGitCommitMessageGenerator {
	readonly _serviceBrand: undefined;

	/**
	 * Generate a git commit message based on the provided diff and context.
	 */
	generateGitCommitMessage(
		repositoryName: string,
		branchName: string,
		changes: IQuizDiff[],
		recentCommitMessages: IQuizRecentCommitMessages,
		attemptCount: number,
		token: CancellationToken,
	): Promise<string | undefined>;
}

export interface IQuizDiff {
	readonly diff: string;
	readonly fileUri?: string;
}

export interface IQuizRecentCommitMessages {
	readonly messages: readonly string[];
}

type QuizResponseFormat = 'noTextCodeBlock' | 'oneTextCodeBlock' | 'multipleTextCodeBlocks';

/**
 * Process a raw generated commit message to extract the text code block.
 */
export function quizProcessGeneratedCommitMessage(raw: string): [QuizResponseFormat, string] {
	const textCodeBlockRegex = /^```text\s*([\s\S]+?)\s*```$/m;
	const textCodeBlockMatch = textCodeBlockRegex.exec(raw);

	if (textCodeBlockMatch === null) {
		return ['noTextCodeBlock', raw];
	}
	if (textCodeBlockMatch.length !== 2) {
		return ['multipleTextCodeBlocks', raw];
	}

	return ['oneTextCodeBlock', textCodeBlockMatch[1]];
}

/**
 * Null implementation.
 */
export class NullQuizGitCommitMessageGenerator implements IQuizGitCommitMessageGenerator {
	declare readonly _serviceBrand: undefined;

	async generateGitCommitMessage(_repositoryName: string, _branchName: string, _changes: IQuizDiff[], _recentCommitMessages: IQuizRecentCommitMessages, _attemptCount: number, _token: CancellationToken): Promise<string | undefined> {
		return undefined;
	}
}
