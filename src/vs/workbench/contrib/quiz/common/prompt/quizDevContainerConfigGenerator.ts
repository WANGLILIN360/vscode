/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/devContainerConfigGenerator.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export const IQuizDevContainerConfigGenerator = createDecorator<IQuizDevContainerConfigGenerator>('quizDevContainerConfigGenerator');

export interface IQuizDevContainerConfigGenerator {
	readonly _serviceBrand: undefined;

	/**
	 * Generate a dev container configuration suggestion based on project files.
	 */
	generate(index: IQuizDevContainerConfigIndex, filenames: string[], token: CancellationToken): Promise<IQuizDevContainerConfigGeneratorResult>;
}

export interface IQuizDevContainerConfigIndex {
	templates: IQuizDevContainerConfigTemplate[];
	features?: IQuizDevContainerConfigFeature[];
}

export interface IQuizDevContainerConfigTemplate {
	id: string;
	name?: string;
	description?: string;
}

export interface IQuizDevContainerConfigFeature {
	id: string;
	name?: string;
	description?: string;
}

export interface IQuizDevContainerConfigGeneratorResult {
	type: 'success';
	template?: string;
	features: string[];
}

const excludedTemplates = [
	'alpine',
	'debian',
	'docker-existing-docker-compose',
	'docker-existing-dockerfile',
	'docker-in-docker',
	'docker-outside-of-docker',
	'docker-outside-of-docker-compose',
	'ubuntu',
	'universal',
].map(shortId => `ghcr.io/devcontainers/templates/${shortId}`);

const excludedFeatures = [
	'common-utils',
	'git',
].map(shortId => `ghcr.io/devcontainers/features/${shortId}`);

/**
 * Filter templates and features, excluding the ones that are not useful for suggestions.
 */
export function quizFilterDevContainerOptions(index: IQuizDevContainerConfigIndex): {
	templates: IQuizDevContainerConfigTemplate[];
	features: IQuizDevContainerConfigFeature[];
} {
	return {
		templates: index.templates.filter(t => !excludedTemplates.includes(t.id)),
		features: (index.features || []).filter(f => !excludedFeatures.includes(f.id)),
	};
}

/**
 * Process filenames to fit within a character limit.
 */
export function quizProcessFilenames(filenames: string[], charLimit: number): string[] {
	const result: string[] = [...filenames];
	const availableChars = Math.floor(charLimit * 0.9);

	let totalChars = result.join('\n').length;
	if (totalChars > availableChars) {
		while (totalChars > availableChars && result.length > 0) {
			const last = result.pop()!;
			totalChars -= last.length;
		}
	}

	return result;
}

/**
 * Null implementation.
 */
export class NullQuizDevContainerConfigGenerator implements IQuizDevContainerConfigGenerator {
	declare readonly _serviceBrand: undefined;

	async generate(_index: IQuizDevContainerConfigIndex, _filenames: string[], _token: CancellationToken): Promise<IQuizDevContainerConfigGeneratorResult> {
		return { type: 'success', features: [] };
	}
}
