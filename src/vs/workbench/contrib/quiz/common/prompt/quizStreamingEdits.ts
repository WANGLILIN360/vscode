/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import type { IQuizResponsePart, IQuizResponseProcessorContext, IQuizResponseStream } from '../intents/quizIntents.js';
import { QuizLines } from './quizEditGeneration.js';

// #region IQuizStreamingEditsStrategy (aligned with Copilot's IStreamingEditsStrategy)

/**
 * Strategy interface for processing a stream of text lines into streaming edits.
 * Implementations determine how the model's response is mapped to file edits
 * (e.g., insert-or-replace, apply-patch).
 */
export interface IQuizStreamingEditsStrategy {
	processStream(stream: AsyncIterable<IQuizLineOfText>): Promise<QuizStreamingEditsResult>;
}

export interface IQuizStreamingEditsStrategyFactory {
	(lineFilter: IQuizLineFilter, streamingWorkingCopyDocument: IQuizStreamingWorkingCopyDocument): IQuizStreamingEditsStrategy;
}

// #endregion

// #region QuizStreamingEditsResult (aligned with Copilot's StreamingEditsResult)

/**
 * The result of processing a stream of edits.
 */
export class QuizStreamingEditsResult {
	constructor(
		public readonly didNoopEdits: boolean,
		public readonly didEdits: boolean,
		public readonly additionalImports: QuizLines,
	) { }
}

// #endregion

// #region IQuizLineOfText (aligned with Copilot's LineOfText)

/**
 * A single line of text from the model's streaming response.
 */
export interface IQuizLineOfText {
	readonly lineNumber: number;
	readonly value: string;
	readonly type: IQuizLineType;
}

export const enum QuizLineType {
	/** A line of code inside a code block */
	InsideCodeBlock = 0,
	/** A line of markdown outside a code block */
	OutsideCodeBlock = 1,
	/** A delimiter line (e.g., ``` language) */
	Delimiter = 2,
}

export type IQuizLineType = QuizLineType;

// #endregion

// #region IQuizLineFilter (aligned with Copilot's ILineFilter)

/**
 * Filter for lines during streaming edit processing.
 */
export interface IQuizLineFilter {
	(line: IQuizLineOfText): boolean;
}

export class QuizLineFilters {
	public static noop: IQuizLineFilter = () => true;

	public static combine(...filters: (IQuizLineFilter | undefined)[]): IQuizLineFilter {
		return (line: IQuizLineOfText) => filters.every(filter => filter ? filter(line) : true);
	}

	/**
	 * Keeps only lines that are inside ``` code blocks.
	 */
	public static createCodeBlockFilter(): IQuizLineFilter {
		const enum State {
			BeforeCodeBlock,
			InCodeBlock,
			AfterCodeBlock
		}
		let state = State.BeforeCodeBlock;
		return (line: IQuizLineOfText) => {
			if (state === State.BeforeCodeBlock) {
				if (/^```/.test(line.value)) {
					state = State.InCodeBlock;
				}
				return false;
			}
			if (state === State.InCodeBlock) {
				if (/^```/.test(line.value)) {
					state = State.AfterCodeBlock;
					return false;
				}
				return true;
			}
			// text after code block
			return false;
		};
	}
}

// #endregion

// #region IQuizStreamingWorkingCopyDocument (aligned with Copilot's StreamingWorkingCopyDocument)

/**
 * A mutable working copy of a document that tracks edits as they stream in.
 * Used by streaming edit strategies to apply edits incrementally.
 */
export interface IQuizStreamingWorkingCopyDocument {
	readonly didEdits: boolean;
	readonly didNoopEdits: boolean;
	readonly didReplaceEdits: boolean;
	readonly additionalImports: QuizLines;
	readonly firstSentLineIndex: number;
	readonly indentStyle: IQuizIndentStyle;

	replaceLine(lineIndex: number, newLine: string): number;
	replaceLines(startLineIndex: number, endLineIndex: number, newLine: string): number;
	deleteLines(startLineIndex: number, endLineIndex: number): void;
	getLine(lineIndex: number): { sentInCodeBlock: IQuizSentInCodeBlock; text: string };
}

export const enum IQuizSentInCodeBlock {
	None = 0,
	Above = 1,
	Range = 2,
	Below = 3,
	Other = 4,
}

export interface IQuizIndentStyle {
	readonly insertSpaces: boolean;
	readonly tabSize: number;
}

// #endregion

// #region IQuizStreamingTextPieceClassifier (aligned with Copilot's IStreamingTextPieceClassifier)

/**
 * Classifies text pieces from a streaming response into code blocks,
 * markdown, and delimiters.
 */
export interface IQuizStreamingTextPieceClassifier {
	(stream: AsyncIterable<string>): AsyncIterable<IQuizClassifiedTextPiece>;
}

export interface IQuizClassifiedTextPiece {
	readonly kind: IQuizTextPieceKind;
	readonly value: string;
}

export const enum QuizTextPieceKind {
	OutsideCodeBlock = 0,
	InsideCodeBlock = 1,
	Delimiter = 2,
}

export type IQuizTextPieceKind = QuizTextPieceKind;

// #endregion

// #region QuizTextPieceClassifiers (aligned with Copilot's TextPieceClassifiers)

export class QuizClassifiedTextPiece {
	constructor(
		public readonly value: string,
		public readonly kind: IQuizTextPieceKind,
	) { }
}

export class QuizTextPieceClassifiers {
	/**
	 * Classifies lines using ``` code blocks.
	 */
	public static createCodeBlockClassifier(): IQuizStreamingTextPieceClassifier {
		return QuizTextPieceClassifiers.attemptToRecoverFromMissingCodeBlock(
			QuizTextPieceClassifiers.createFencedBlockClassifier('```')
		);
	}

	private static attemptToRecoverFromMissingCodeBlock(classifier: IQuizStreamingTextPieceClassifier): IQuizStreamingTextPieceClassifier {
		return async function* (source: AsyncIterable<string>) {
			const bufferedPieces: QuizClassifiedTextPiece[] = [];
			let sawOnlyLeadingText = true;
			for await (const piece of classifier(source)) {
				if (!sawOnlyLeadingText) {
					yield piece;
				} else if (piece.kind === QuizTextPieceKind.OutsideCodeBlock) {
					bufferedPieces.push(piece as QuizClassifiedTextPiece);
				} else {
					sawOnlyLeadingText = false;
					for (const p of bufferedPieces) {
						yield p;
					}
					bufferedPieces.length = 0;
					yield piece;
				}
			}

			if (sawOnlyLeadingText) {
				const allText = bufferedPieces.map(p => p.value).join('');
				// Heuristic: if no code block was found, treat everything as outside
				yield new QuizClassifiedTextPiece(allText, QuizTextPieceKind.OutsideCodeBlock);
			}
		};
	}

	/**
	 * Classifies all text as being inside a code block.
	 */
	public static createAlwaysInsideCodeBlockClassifier(): IQuizStreamingTextPieceClassifier {
		return async function* (source: AsyncIterable<string>) {
			for await (const line of source) {
				yield new QuizClassifiedTextPiece(line, QuizTextPieceKind.InsideCodeBlock);
			}
		};
	}

	/**
	 * Classifies lines using fenced blocks with the provided fence string.
	 */
	public static createFencedBlockClassifier(fence: string): IQuizStreamingTextPieceClassifier {
		return async function* (source: AsyncIterable<string>) {
			let state: IQuizTextPieceKind = QuizTextPieceKind.OutsideCodeBlock;
			let buffer = '';

			for await (const chunk of source) {
				buffer += chunk;
				let newlineIdx: number;
				while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
					const line = buffer.substring(0, newlineIdx);
					buffer = buffer.substring(newlineIdx + 1);

					if (line.startsWith(fence)) {
						yield new QuizClassifiedTextPiece(line + '\n', QuizTextPieceKind.Delimiter);
						state = state === QuizTextPieceKind.InsideCodeBlock
							? QuizTextPieceKind.OutsideCodeBlock
							: QuizTextPieceKind.InsideCodeBlock;
					} else {
						yield new QuizClassifiedTextPiece(line + '\n', state);
					}
				}
			}

			if (buffer.length > 0) {
				if (buffer.startsWith(fence)) {
					yield new QuizClassifiedTextPiece(buffer, QuizTextPieceKind.Delimiter);
				} else {
					yield new QuizClassifiedTextPiece(buffer, state);
				}
			}
		};
	}
}

// #endregion

// #region IQuizMatchedDocumentLine (aligned with Copilot's MatchedDocumentLine)

/**
 * A line in the document that was matched against a line in the model's response.
 */
export interface IQuizMatchedDocumentLine {
	readonly lineIndex: number;
	readonly text: string;
}

// #endregion

// #region QuizEarlyStopping (aligned with Copilot's EarlyStopping)

export const enum QuizEarlyStopping {
	None = 0,
	StopAfterFirstCodeBlock = 1,
}

// #endregion

// #region IQuizReplyInterpreterWithMetadata (aligned with Copilot's ReplyInterpreterMetaData)

/**
 * Metadata wrapper that associates a reply interpreter with prompt metadata.
 */
export interface IQuizReplyInterpreterWithMetadata {
	readonly replyInterpreter: IQuizStreamingReplyInterpreter;
}

export interface IQuizStreamingReplyInterpreter {
	processResponse(
		context: IQuizStreamingResponseProcessorContext,
		inputStream: AsyncIterable<IQuizResponsePart>,
		outputStream: IQuizResponseStream,
		token: CancellationToken,
	): Promise<void>;
}
// Use IQuizResponseProcessorContext as the streaming context type
export type IQuizStreamingResponseProcessorContext = IQuizResponseProcessorContext;

// #endregion

// #region QuizStreamingEditsController (aligned with Copilot's StreamingEditsController)

/**
 * Controller that processes a streaming LLM response into streaming edits.
 * Manages the pipeline: raw text → text piece classification → line streaming → edit strategy.
 */
export class QuizStreamingEditsController {

	private readonly _responseChunks: string[] = [];
	private _lastLength: number = 0;
	private _leftFirstCodeBlock = false;

	constructor(
		private readonly _earlyStopping: QuizEarlyStopping,
		private readonly _textPieceClassifier: IQuizStreamingTextPieceClassifier,
		private readonly _streamingEditsStrategy: IQuizStreamingEditsStrategy,
	) { }

	public update(newText: string): { shouldFinish: boolean } {
		if (this._earlyStopping === QuizEarlyStopping.StopAfterFirstCodeBlock && this._leftFirstCodeBlock) {
			return { shouldFinish: true };
		}

		this._responseChunks.push(newText.slice(this._lastLength));
		this._lastLength = newText.length;
		return { shouldFinish: false };
	}

	public async finish(): Promise<QuizStreamingEditsResult> {
		const fullText = this._responseChunks.join('');
		const textPieceStream = this._textPieceClassifier((async function* () { yield fullText; })());

		// Collect inside-code-block pieces and feed them to the strategy
		const codeLines: IQuizLineOfText[] = [];
		let lineNum = 0;
		for await (const piece of textPieceStream) {
			if (piece.kind === QuizTextPieceKind.InsideCodeBlock) {
				const lines = piece.value.split(/\r\n|\r|\n/g);
				for (const line of lines) {
					if (line || lines.length > 1) {
						codeLines.push({ lineNumber: lineNum++, value: line, type: QuizLineType.InsideCodeBlock });
					}
				}
			} else if (piece.kind === QuizTextPieceKind.Delimiter) {
				this._leftFirstCodeBlock = true;
			}
		}

		const result = await this._streamingEditsStrategy.processStream(
			(async function* () { for (const line of codeLines) { yield line; } })()
		);
		return result;
	}
}

// #endregion
