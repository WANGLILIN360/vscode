/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/testFiles.ts

import { URI } from '../../../../../base/common/uri.js';
import * as resources from '../../../../../base/common/resources.js';
import { Schemas } from '../../../../../base/common/network.js';

type QuizTestHint = {
	prefix?: string;
	suffixes?: string[];
	location: 'sameFolder' | 'testFolder';
};

const nullTestHint: Required<QuizTestHint> = {
	location: 'sameFolder',
	prefix: 'test_',
	suffixes: ['.test', '.spec', '_test', 'Test', '_spec', '_test', 'Tests', '.Tests', 'Spec'],
};

const testHintsByLanguage: Record<string, QuizTestHint> = {
	csharp: { suffixes: ['Test'], location: 'testFolder' },
	dart: { suffixes: ['_test'], location: 'testFolder' },
	go: { suffixes: ['_test'], location: 'sameFolder' },
	java: { suffixes: ['Test'], location: 'testFolder' },
	javascript: { suffixes: ['.test', '.spec'], location: 'sameFolder' },
	javascriptreact: { suffixes: ['.test', '.spec'], location: 'sameFolder' },
	kotlin: { suffixes: ['Test'], location: 'testFolder' },
	php: { suffixes: ['Test'], location: 'testFolder' },
	powershell: { suffixes: ['.Tests'], location: 'testFolder' },
	python: { prefix: 'test_', suffixes: ['_test'], location: 'testFolder' },
	ruby: { suffixes: ['_test', '_spec'], location: 'testFolder' },
	rust: { suffixes: [''], location: 'testFolder' },
	swift: { suffixes: ['Tests'], location: 'testFolder' },
	typescript: { suffixes: ['.test', '.spec'], location: 'sameFolder' },
	typescriptreact: { suffixes: ['.test', '.spec'], location: 'sameFolder' },
};

export const suffix2Language: Record<string, keyof typeof testHintsByLanguage> = {
	cs: 'csharp',
	dart: 'dart',
	go: 'go',
	java: 'java',
	js: 'javascriptreact',
	kt: 'kotlin',
	php: 'php',
	ps1: 'powershell',
	py: 'python',
	rb: 'ruby',
	rs: 'rust',
	swift: 'swift',
	ts: 'typescript',
	tsx: 'typescriptreact',
};

const testHintsBySuffix: { [key: string]: QuizTestHint } = (function () {
	const result: { [key: string]: QuizTestHint } = {};
	for (const [suffix, langId] of Object.entries(suffix2Language)) {
		result[suffix] = <QuizTestHint>testHintsByLanguage[langId];
	}
	return result;
})();

/**
 * Determines whether a given URI or document-like object is a test file.
 */
export function quizIsTestFile(candidate: URI | { uri: URI; languageId: string }): boolean {

	let testHint: QuizTestHint | undefined;
	if (!(candidate instanceof URI)) {
		testHint = testHintsByLanguage[candidate.languageId];
		candidate = candidate.uri;
	}

	const sourceFileName = resources.basename(candidate);
	const sourceFileExtension = resources.extname(candidate);
	testHint ??= testHintsBySuffix[sourceFileExtension.replace('.', '')];

	if (testHint) {

		if (testHint.suffixes) {
			const foundSuffixMatch = testHint.suffixes.some(suffix =>
				sourceFileName.endsWith(suffix + sourceFileExtension)
			);
			if (foundSuffixMatch) {
				return true;
			}
		}
		if (testHint.prefix && sourceFileName.startsWith(testHint.prefix)) {
			return true;
		}

	} else {
		const foundSuffixMatch = nullTestHint.suffixes.some(suffix => sourceFileName.endsWith(suffix + sourceFileExtension));
		if (foundSuffixMatch) {
			return true;
		}
		if (sourceFileName.startsWith(nullTestHint.prefix)) {
			return true;
		}
	}
	return false;
}

export function quizSuggestTestFileBasename(document: { uri: URI; languageId: string }): string {
	const testHint = testHintsByLanguage[document.languageId] ?? nullTestHint;
	const basename = resources.basename(document.uri);

	if (testHint.prefix) {
		return testHint.prefix + basename;
	}

	const ext = resources.extname(document.uri);
	const suffix = testHint.suffixes && testHint.suffixes.length > 0
		? testHint.suffixes[0]
		: '.test';

	return basename.replace(`${ext}`, `${suffix}${ext}`);
}


export function quizSuggestTestFileDir(document: { uri: URI; languageId: string }): URI {
	const srcFileLocation = resources.joinPath(document.uri, '..');
	if (document.languageId === 'java') {
		const srcFilePath = srcFileLocation.path;
		if (srcFilePath.includes('/src/main/')) {
			const testFilePath = srcFilePath.replace('/src/main/', '/src/test/');
			return srcFileLocation.with({ path: testFilePath });
		}
	}
	return srcFileLocation;
}

export function quizSuggestUntitledTestFileLocation(document: { uri: URI; languageId: string }): URI {
	const newBasename = quizSuggestTestFileBasename(document);
	const newLocation = quizSuggestTestFileDir(document);
	const testFileUri = URI.joinPath(newLocation, newBasename).with({ scheme: Schemas.untitled });
	return testFileUri;
}

/**
 * Get test name candidates for a source file, used for finding test files.
 */
export function quizGetTestNameCandidates(basename: string, ext: string, languageId: string): string[] {
	const testHint = testHintsByLanguage[languageId] ?? nullTestHint;
	const testNameCandidates: string[] = [];
	if (testHint.prefix) {
		testNameCandidates.push(testHint.prefix + basename);
	}
	if (testHint.suffixes) {
		for (const suffix of testHint.suffixes ?? []) {
			const testName = basename.replace(`${ext}`, `${suffix}${ext}`);
			testNameCandidates.push(testName);
		}
	}
	return testNameCandidates;
}

/**
 * Build a glob pattern for finding test files matching a source file.
 */
export function quizGetTestFilePattern(basename: string, ext: string, languageId: string): string {
	const candidates = quizGetTestNameCandidates(basename, ext, languageId);
	const pattern =
		candidates.length === 1
			? `**/${candidates[0]}`
			: `**/{${candidates.join(',')}}`;
	return pattern;
}
