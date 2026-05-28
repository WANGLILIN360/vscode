/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/parser/node/treeSitterLanguages.ts
//
// Copilot's file is in node/ layer because it loads WASM parsers at runtime.
// Quiz places this in common/ because it only defines the language enum and
// mapping — actual parser loading is handled by VS Code's built-in
// tree-sitter infrastructure (ITextModel.tokenization).

// #region QuizWasmLanguage (aligned with Copilot's WASMLanguage)

/**
 * Languages we can parse using tree-sitter. Each enum member corresponds
 * to a tree-sitter parser.
 * Aligned with Copilot's WASMLanguage (platform/parser/node/treeSitterLanguages.ts).
 */
export enum QuizWasmLanguage {
	Python = 'python',
	JavaScript = 'javascript',
	TypeScript = 'typescript',
	TypeScriptTsx = 'tsx',
	Go = 'go',
	Ruby = 'ruby',
	Csharp = 'csharp',
	Cpp = 'cpp',
	Java = 'java',
	Rust = 'rust',
}

// #endregion

// #region QuizTreeSitterUnknownLanguageError (aligned with Copilot's TreeSitterUnknownLanguageError)

/**
 * Error thrown when an unrecognized language is used with tree-sitter.
 * Aligned with Copilot's TreeSitterUnknownLanguageError.
 */
export class QuizTreeSitterUnknownLanguageError extends Error {
	constructor(language: string) {
		super(`Unrecognized language: ${language}`);
	}
}

// #endregion

// #region Language ID to WASM language mapping (aligned with Copilot's languageIdToWasmLanguageMapping)

/**
 * Mapping from VS Code language IDs to tree-sitter WASM language enum values.
 * Aligned with Copilot's languageIdToWasmLanguageMapping.
 */
const languageIdToQuizWasmLanguageMapping: { [language: string]: QuizWasmLanguage } = {
	python: QuizWasmLanguage.Python,
	javascript: QuizWasmLanguage.JavaScript,
	javascriptreact: QuizWasmLanguage.JavaScript,
	jsx: QuizWasmLanguage.JavaScript,
	typescript: QuizWasmLanguage.TypeScript,
	typescriptreact: QuizWasmLanguage.TypeScriptTsx,
	tsx: QuizWasmLanguage.TypeScriptTsx,
	go: QuizWasmLanguage.Go,
	ruby: QuizWasmLanguage.Ruby,
	csharp: QuizWasmLanguage.Csharp,
	cpp: QuizWasmLanguage.Cpp,
	java: QuizWasmLanguage.Java,
	rust: QuizWasmLanguage.Rust,
};

// #endregion

// #region getQuizWasmLanguage (aligned with Copilot's getWasmLanguage)

/**
 * Convert a VS Code language ID to a tree-sitter WASM language enum value.
 * Aligned with Copilot's getWasmLanguage().
 *
 * @param languageId The VS Code language ID (e.g., 'typescript', 'python')
 * @returns The corresponding QuizWasmLanguage, or undefined if not supported
 */
export function getQuizWasmLanguage(languageId: string): QuizWasmLanguage | undefined {
	if (Object.prototype.hasOwnProperty.call(languageIdToQuizWasmLanguageMapping, languageId)) {
		return languageIdToQuizWasmLanguageMapping[languageId];
	}
	return undefined;
}

// #endregion

// #region isQuizTreeSitterSupportedLanguage

/**
 * Check whether a language ID is supported by tree-sitter.
 *
 * @param languageId The VS Code language ID
 * @returns true if tree-sitter parsing is available for this language
 */
export function isQuizTreeSitterSupportedLanguage(languageId: string): boolean {
	return Object.prototype.hasOwnProperty.call(languageIdToQuizWasmLanguageMapping, languageId);
}

// #endregion
