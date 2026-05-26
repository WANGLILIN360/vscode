/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region Lines type (aligned with Copilot's Lines)

/**
 * An immutable array of text lines (without line terminators).
 */
export type QuizLines = readonly string[];

/**
 * A range of lines identified by first and end line indices (0-based, end exclusive).
 */
export interface IQuizLineRange {
	readonly firstLineIndex: number;
	readonly endLineIndex: number;
}

// #endregion

// #region QuizLines utility namespace (aligned with Copilot's Lines namespace)

export namespace QuizLines {
	export function fromString(code: string): QuizLines {
		if (code.length === 0) {
			return [];
		}
		return code.split(/\r\n|\r|\n/g);
	}

	export function fromDocument(doc: { lineCount: number; lineAt(i: number): { text: string } }): QuizLines {
		if (doc.lineCount === 0) {
			return [];
		}
		const result: string[] = [];
		for (let i = 0; i < doc.lineCount; i++) {
			result.push(doc.lineAt(i).text);
		}
		return result;
	}

	export function toString(lines: QuizLines): string {
		return lines.join('\n');
	}
}

// #endregion

// #region QuizLinesEdit (aligned with Copilot's LinesEdit)

/**
 * Represents an edit operation on a set of lines.
 * Can replace a range of lines or insert new lines at a position.
 */
export class QuizLinesEdit {
	constructor(
		public readonly firstLineIndex: number,
		public readonly endLineIndex: number,
		public readonly lines: QuizLines,
		public readonly prefix = '',
		public readonly suffix = '\n',
	) { }

	/**
	 * Apply this edit to a set of lines, returning the new lines.
	 */
	apply(lines: QuizLines): QuizLines {
		const before = lines.slice(0, this.firstLineIndex);
		const after = lines.slice(this.endLineIndex);
		return before.concat(this.lines, after);
	}

	/**
	 * The text representation of this edit (including prefix/suffix).
	 */
	get text(): string {
		return this.lines.length > 0 ? (this.prefix + this.lines.join('\n') + this.suffix) : '';
	}

	static insert(line: number, lines: QuizLines): QuizLinesEdit {
		return new QuizLinesEdit(line, line, lines);
	}

	static replace(firstLineIndex: number, endLineIndex: number, lines: QuizLines, isLastLine = false): QuizLinesEdit {
		if (isLastLine) {
			return new QuizLinesEdit(firstLineIndex, endLineIndex, lines, '', '');
		}
		return new QuizLinesEdit(firstLineIndex, endLineIndex, lines);
	}
}

// #endregion

// #region trimLeadingWhitespace (aligned with Copilot's trimLeadingWhitespace)

/**
 * Trim leading whitespace from a string, preserving relative indentation.
 */
export function isQuizLines(lines: unknown): lines is QuizLines {
	return Array.isArray(lines) && typeof lines[0] === 'string';
}

export function trimLeadingWhitespace(text: string): string {
	const lines = text.split(/\r\n|\r|\n/g);
	let minIndent = Infinity;
	for (const line of lines) {
		if (line.length === 0) {
			continue;
		}
		const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
		if (indent < minIndent) {
			minIndent = indent;
		}
	}
	if (minIndent === Infinity) {
		minIndent = 0;
	}
	return lines.map(line => line.slice(minIndent)).join('\n');
}

// #endregion

// #region QuizEditStrategy (aligned with Copilot's EditStrategy)

/**
 * Strategy for how edits should be applied when there are no clear hints
 * (no code markers and no diffing heuristics) about the edit location.
 */
export const enum QuizEditStrategy {
	/** Insert above the current range */
	FallbackToInsertAboveRange = 1,
	/** Replace the current range */
	FallbackToReplaceRange = 2,
	/** Insert below the current range */
	FallbackToInsertBelowRange = 3,
	/** Code Generation: always insert at the cursor location */
	ForceInsertion = 4,
}

// #endregion

// #region applyEdits (aligned with Copilot's applyEdits from prompt/node/intents.ts)

/**
 * Apply a set of text edits to a source string.
 * Edits are applied in reverse order (from bottom to top) to avoid offset shifts.
 */
export function applyQuizEdits(text: string, edits: readonly { readonly offset: number; readonly length: number; readonly newText: string }[]): string {
	// Sort by offset descending (stable sort preserves order for same offset)
	const sorted = [...edits].sort((a, b) => b.offset - a.offset || b.length - a.length);
	for (const edit of sorted) {
		text = text.substring(0, edit.offset) + edit.newText + text.substring(edit.offset + edit.length);
	}
	return text;
}

// #endregion
