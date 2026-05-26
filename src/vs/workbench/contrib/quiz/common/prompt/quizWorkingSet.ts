/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNumber, isString } from '../../../../../base/common/types.js';
import { isUriComponents, URI, UriComponents } from '../../../../../base/common/uri.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { PositionOffsetTransformer } from '../../../../../editor/common/core/text/positionToOffsetImpl.js';
import { EndOfLineSequence } from '../../../../../editor/common/model.js';
import { IQuizRange } from '../quizSharedTypes.js';

// #region WorkingSetEntryState (aligned with Copilot's WorkingSetEntryState)

export enum QuizWorkingSetEntryState {
	Initial = 0,
	Undecided = 1,
	Accepted = 2,
	Rejected = 3,
}

// #endregion

// #region QuizTextDocumentSnapshot (aligned with Copilot's TextDocumentSnapshot)

/**
 * JSON representation of a text document snapshot for serialization.
 */
export interface IQuizTextDocumentSnapshotJSON {
	readonly uri: UriComponents;
	readonly _text: string;
	readonly languageId: string;
	readonly version: number;
	readonly eol: EndOfLineSequence;
}

export function isQuizTextDocumentSnapshotJSON(thing: unknown): thing is IQuizTextDocumentSnapshotJSON {
	if (!thing || typeof thing !== 'object') {
		return false;
	}
	return isUriComponents((thing as IQuizTextDocumentSnapshotJSON).uri) && isString((thing as IQuizTextDocumentSnapshotJSON)._text) && isString((thing as IQuizTextDocumentSnapshotJSON).languageId) && isNumber((thing as IQuizTextDocumentSnapshotJSON).version) && isNumber((thing as IQuizTextDocumentSnapshotJSON).eol);
}

/**
 * Immutable snapshot of a text document's content at a point in time.
 * Aligned with Copilot's TextDocumentSnapshot class.
 */
export class QuizTextDocumentSnapshot {

	static create(text: string, uri: URI, languageId: string, eol: EndOfLineSequence, version: number): QuizTextDocumentSnapshot {
		return new QuizTextDocumentSnapshot(uri, text, languageId, eol, version);
	}

	static fromNewText(text: string, snapshot: QuizTextDocumentSnapshot): QuizTextDocumentSnapshot {
		return new QuizTextDocumentSnapshot(snapshot.uri, text, snapshot.languageId, snapshot.eol, snapshot.version + 1);
	}

	static fromJSON(json: IQuizTextDocumentSnapshotJSON): QuizTextDocumentSnapshot {
		return new QuizTextDocumentSnapshot(URI.from(json.uri), json._text, json.languageId, json.eol, json.version);
	}

	readonly uri: URI;
	readonly languageId: string;
	readonly version: number;
	readonly eol: EndOfLineSequence;
	private readonly _text: string;
	private _transformer: PositionOffsetTransformer | null = null;

	private get transformer(): PositionOffsetTransformer {
		if (!this._transformer) {
			this._transformer = new PositionOffsetTransformer(this._text);
		}
		return this._transformer;
	}

	get fileName(): string {
		return this.uri.fsPath;
	}

	get isUntitled(): boolean {
		return this.uri.scheme === 'untitled';
	}

	private _lines: string[] | null = null;
	get lines(): readonly string[] {
		if (!this._lines) {
			this._lines = this._text.split(/\r\n|\r|\n/g);
		}
		return this._lines;
	}

	get lineCount(): number {
		return this.lines.length;
	}

	private constructor(uri: URI, text: string, languageId: string, eol: EndOfLineSequence, version: number) {
		this.uri = uri;
		this._text = text;
		this.languageId = languageId;
		this.eol = eol;
		this.version = version;
	}

	getLineContent(lineNumber: number): string {
		return this.lines[lineNumber - 1];
	}

	offsetAt(position: Position): number {
		position = this.validatePosition(position);
		return this.transformer.getOffset(position);
	}

	positionAt(offset: number): Position {
		offset = Math.floor(offset);
		offset = Math.max(0, offset);
		return this.transformer.getPosition(offset);
	}

	getText(range?: Range): string {
		if (!range) {
			return this._text;
		}

		const validatedRange = this.validateRange(range);
		if (validatedRange.isEmpty()) {
			return '';
		}

		const startOffset = this.transformer.getOffset(validatedRange.getStartPosition());
		const endOffset = this.transformer.getOffset(validatedRange.getEndPosition());
		return this._text.substring(startOffset, endOffset);
	}

	validateRange(range: Range): Range {
		const start = this.validatePosition(range.getStartPosition());
		const end = this.validatePosition(range.getEndPosition());
		if (start.equals(range.getStartPosition()) && end.equals(range.getEndPosition())) {
			return range;
		}
		return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
	}

	validatePosition(position: Position): Position {
		if (this._text.length === 0) {
			return new Position(1, 1);
		}

		let { lineNumber, column } = position;
		let hasChanged = false;

		if (lineNumber < 1) {
			lineNumber = 1;
			column = 1;
			hasChanged = true;
		} else if (lineNumber > this.lines.length) {
			lineNumber = this.lines.length;
			column = this.lines[lineNumber - 1].length + 1;
			hasChanged = true;
		} else {
			const maxColumn = this.lines[lineNumber - 1].length + 1;
			if (column < 1) {
				column = 1;
				hasChanged = true;
			} else if (column > maxColumn) {
				column = maxColumn;
				hasChanged = true;
			}
		}

		if (!hasChanged) {
			return position;
		}
		return new Position(lineNumber, column);
	}

	toJSON(): IQuizTextDocumentSnapshotJSON {
		return {
			uri: this.uri.toJSON() as UriComponents,
			languageId: this.languageId,
			version: this.version,
			eol: this.eol,
			_text: this._text,
		};
	}
}

// #endregion

// #region QuizNotebookDocumentSnapshot (aligned with Copilot's NotebookDocumentSnapshot)

/**
 * JSON representation of a notebook document snapshot for serialization.
 */
export interface IQuizNotebookDocumentSnapshotJSON {
	readonly type: 'notebook';
	readonly uri: UriComponents;
	readonly _text: string;
	readonly languageId: string;
	readonly version: number;
	readonly cellCount: number;
}

export function isQuizNotebookDocumentSnapshotJSON(thing: unknown): thing is IQuizNotebookDocumentSnapshotJSON {
	if (!thing || typeof thing !== 'object') {
		return false;
	}
	const obj = thing as IQuizNotebookDocumentSnapshotJSON;
	return obj.type === 'notebook' && isUriComponents(obj.uri) && isString(obj._text) && isString(obj.languageId) && isNumber(obj.version) && isNumber(obj.cellCount);
}

/**
 * Immutable snapshot of a notebook document's content at a point in time.
 * Aligned with Copilot's NotebookDocumentSnapshot class.
 */
export class QuizNotebookDocumentSnapshot {

	static create(uri: URI, version: number, cells: readonly { text: string; language: string }[]): QuizNotebookDocumentSnapshot {
		return new QuizNotebookDocumentSnapshot(uri, version, cells);
	}

	static fromNewText(cells: readonly { text: string; language: string }[], snapshot: QuizNotebookDocumentSnapshot): QuizNotebookDocumentSnapshot {
		return new QuizNotebookDocumentSnapshot(snapshot.uri, snapshot.version + 1, cells);
	}

	static fromJSON(json: IQuizNotebookDocumentSnapshotJSON): QuizNotebookDocumentSnapshot {
		// Reconstruct from JSON - cells need to be repopulated by caller
		return new QuizNotebookDocumentSnapshot(URI.from(json.uri), json.version, []);
	}

	readonly type = 'notebook' as const;
	readonly uri: URI;
	readonly version: number;
	private readonly _cells: readonly { text: string; language: string }[];

	private constructor(uri: URI, version: number, cells: readonly { text: string; language: string }[]) {
		this.uri = uri;
		this.version = version;
		this._cells = cells;
	}

	get cellCount(): number {
		return this._cells.length;
	}

	getCellText(index: number): string {
		return this._cells[index].text;
	}

	getCellLanguage(index: number): string {
		return this._cells[index].language;
	}

	/** Get the full text of the notebook (all cells concatenated). */
	getText(): string {
		return this._cells.map(cell => cell.text).join('\n');
	}

	/** Get the language ID for the notebook (defaults to first cell's language). */
	get languageId(): string {
		if (this._cells.length === 0) {
			return 'python';
		}
		return this._cells[0].language;
	}

	/** Get line count across all cells. */
	get lineCount(): number {
		return this.getText().split(/\r\n|\r|\n/g).length;
	}

	toJSON(): IQuizNotebookDocumentSnapshotJSON {
		return {
			type: 'notebook',
			uri: this.uri.toJSON() as UriComponents,
			languageId: this.languageId,
			version: this.version,
			cellCount: this.cellCount,
			_text: this.getText(),
		};
	}
}

// #endregion

// #region IQuizTextDocumentWorkingSetEntry (aligned with Copilot's ITextDocumentWorkingSetEntry)

export interface IQuizTextDocumentWorkingSetEntry {
	readonly document: QuizTextDocumentSnapshot;
	readonly range?: IQuizRange;
	readonly state: QuizWorkingSetEntryState;
	readonly isMarkedReadonly: boolean | undefined;
}

// #endregion

// #region IQuizNotebookWorkingSetEntry (aligned with Copilot's INotebookWorkingSetEntry)

export interface IQuizNotebookWorkingSetEntry {
	readonly document: QuizNotebookDocumentSnapshot;
	readonly range?: IQuizRange;
	readonly state: QuizWorkingSetEntryState;
	readonly isMarkedReadonly: boolean | undefined;
}

// #endregion

// #region IQuizWorkingSetEntry / IQuizWorkingSet (aligned with Copilot's IWorkingSetEntry / IWorkingSet)

export type IQuizWorkingSetEntry = IQuizTextDocumentWorkingSetEntry | IQuizNotebookWorkingSetEntry;

export type IQuizWorkingSet = readonly IQuizWorkingSetEntry[];

// #endregion

// #region Type guards (aligned with Copilot's isTextDocumentWorkingSetEntry / isNotebookWorkingSetEntry)

export function isQuizTextDocumentWorkingSetEntry(entry: IQuizWorkingSetEntry): entry is IQuizTextDocumentWorkingSetEntry {
	return (entry.document instanceof QuizTextDocumentSnapshot);
}

export function isQuizNotebookWorkingSetEntry(entry: IQuizWorkingSetEntry): entry is IQuizNotebookWorkingSetEntry {
	return (entry.document instanceof QuizNotebookDocumentSnapshot);
}

// #endregion
