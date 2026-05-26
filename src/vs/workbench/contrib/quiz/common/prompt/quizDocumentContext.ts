/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import type { IQuizDocumentContext } from '../intents/quizIntents.js';
import { IQuizRange } from '../quizSharedTypes.js';
import { QuizTextDocumentSnapshot, QuizNotebookDocumentSnapshot } from './quizWorkingSet.js';

// #region IQuizLanguage (aligned with Copilot's ILanguage)

/**
 * Language information for a document, used for language-specific editing logic.
 */
export interface IQuizLanguage {
	readonly languageId: string;
	readonly extensions: readonly string[];
	readonly isBlockCommentDelimiters?: [string, string];
	readonly isLineCommentDelimiter?: string;
}

// #endregion

// #region IQuizDocumentContextFull (aligned with Copilot's IDocumentContext)

/**
 * Extended document context that includes the full document snapshot,
 * language information, and formatting options.
 * This extends the basic IQuizDocumentContext (which has URI + range)
 * to support editing scenarios that need the actual document content.
 * Aligned with Copilot's IDocumentContext which always uses TextDocumentSnapshot.
 */
export interface IQuizDocumentContextFull extends IQuizDocumentContext {
	/** Full document snapshot with content access */
	readonly document: QuizTextDocumentSnapshot | QuizNotebookDocumentSnapshot;
	/** Formatting options for the file (indentation) */
	readonly fileIndentInfo: IQuizFormattingOptions | undefined;
	/** Language metadata for the document */
	readonly language: IQuizLanguage;
	/** The whole range of interest (e.g., visible range or selection) */
	readonly wholeRange: IQuizRange;
	/** The user's current selection */
	readonly selection: IQuizRange;
	/** URI of the document (derived from document.uri, satisfies IQuizDocumentContext) */
	readonly documentUri: URI;
	/** Language ID (derived from document.languageId, satisfies IQuizDocumentContext) */
	readonly languageId: string;
}

// #endregion

// #region IQuizFormattingOptions (aligned with vscode.FormattingOptions)

export interface IQuizFormattingOptions {
	readonly tabSize: number;
	readonly insertSpaces: boolean;
}

// #endregion

// #region IQuizDocumentContext utilities

export namespace IQuizDocumentContextFull {
	/**
	 * Check if the document context is for a notebook.
	 */
	export function isNotebook(context: IQuizDocumentContextFull): context is IQuizDocumentContextFull & { document: QuizNotebookDocumentSnapshot } {
		return context.document instanceof QuizNotebookDocumentSnapshot;
	}

	/**
	 * Check if the document context is for a text document.
	 */
	export function isTextDocument(context: IQuizDocumentContextFull): context is IQuizDocumentContextFull & { document: QuizTextDocumentSnapshot } {
		return context.document instanceof QuizTextDocumentSnapshot;
	}

	/**
	 * Get the URI from a document context.
	 */
	export function getUri(context: IQuizDocumentContextFull): URI {
		return context.document.uri;
	}

	/**
	 * Create an IQuizDocumentContextFull from a snapshot and formatting info.
	 * Aligned with Copilot's IDocumentContext.fromEditor / fromTextDocument.
	 */
	export function fromSnapshot(
		document: QuizTextDocumentSnapshot | QuizNotebookDocumentSnapshot,
		options: {
			readonly fileIndentInfo?: IQuizFormattingOptions;
			readonly language: IQuizLanguage;
			readonly wholeRange: IQuizRange;
			readonly selection: IQuizRange;
		},
	): IQuizDocumentContextFull {
		return {
			document,
			documentUri: document.uri,
			languageId: document.languageId,
			fileIndentInfo: options.fileIndentInfo,
			language: options.language,
			wholeRange: options.wholeRange,
			selection: options.selection,
		};
	}
}

// #endregion
