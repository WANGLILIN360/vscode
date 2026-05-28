/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/workspaceRecorder/common/workspaceLog.ts
//
// This file defines the log entry types for workspace recording/replay.
// Copilot uses these for recording user sessions and replaying them for
// debugging and testing. Quiz provides the same types for compatibility,
// though the actual recorder implementation is in the browser/ layer.

// #region QuizLogDocumentId (aligned with Copilot's LogDocumentId)

/**
 * Numeric identifier for a document in the workspace log.
 * Aligned with Copilot's LogDocumentId.
 */
export type QuizLogDocumentId = number;

// #endregion

// #region QuizLogEntry (aligned with Copilot's LogEntry)

/**
 * Union type of all possible log entries.
 * Aligned with Copilot's LogEntry.
 */
export type QuizLogEntry =
	| IQuizHeaderLogEntry
	| IQuizApplicationStartLogEntry
	| IQuizDocumentSetContentLogEntry
	| IQuizDocumentStoreContentLogEntry
	| IQuizDocumentRestoreContentLogEntry
	| IQuizDocumentOpenedLogEntry
	| IQuizDocumentClosedLogEntry
	| IQuizDocumentChangedLogEntry
	| IQuizDocumentFocusChangedLogEntry
	| IQuizDocumentSelectionChangedLogEntry
	| IQuizDocumentEncounteredLogEntry
	| IQuizMetaLogEntry
	| IQuizBookmarkLogEntry
	| IQuizDocumentEventLogEntry
	| IQuizEventLogEntry;

// #endregion

// #region DocumentLogEntry base (aligned with Copilot's DocumentLogEntry)

/**
 * Base type for document-related log entries.
 * Aligned with Copilot's DocumentLogEntry.
 */
export interface IQuizDocumentLogEntry {
	id: QuizLogDocumentId;
	time: number;
}

export namespace IQuizDocumentLogEntry {
	export function is(entry: unknown): entry is IQuizDocumentLogEntry {
		return !!entry && typeof entry === 'object' && 'id' in entry && 'time' in entry;
	}
}

// #endregion

// #region Individual log entry types (aligned with Copilot's log entry types)

/** First entry of the log. Aligned with Copilot's HeaderLogEntry. */
export interface IQuizHeaderLogEntry {
	documentType: 'workspaceRecording@1.0';
	kind: 'header';
	repoRootUri: string;
	time: number;
	uuid: string;
	/** Increments on non-breaking changes */
	revision?: number;
}

/** Application start event. Aligned with Copilot's ApplicationStartLogEntry. */
export interface IQuizApplicationStartLogEntry {
	kind: 'applicationStart';
	time: number;
	commitHash?: string;
}

/** Set document content. Aligned with Copilot's DocumentSetContentLogEntry. */
export interface IQuizDocumentSetContentLogEntry extends IQuizDocumentLogEntry {
	kind: 'setContent';
	content: string;
	v: number | undefined;
}

/** Store content by ID for later restore. Aligned with Copilot's DocumentStoreContentLogEntry. */
export interface IQuizDocumentStoreContentLogEntry extends IQuizDocumentLogEntry {
	kind: 'storeContent';
	contentId: string;
	v: number | undefined;
}

/** Restore content from a previously stored ID. Aligned with Copilot's DocumentRestoreContentLogEntry. */
export interface IQuizDocumentRestoreContentLogEntry extends IQuizDocumentLogEntry {
	kind: 'restoreContent';
	contentId: string;
	v: number | undefined;
}

/** Document opened. Aligned with Copilot's DocumentOpenedLogEntry. */
export interface IQuizDocumentOpenedLogEntry extends IQuizDocumentLogEntry {
	kind: 'opened';
}

/** Document closed. Aligned with Copilot's DocumentClosedLogEntry. */
export interface IQuizDocumentClosedLogEntry extends IQuizDocumentLogEntry {
	kind: 'closed';
}

/** Document changed. Aligned with Copilot's DocumentChangedLogEntry. */
export interface IQuizDocumentChangedLogEntry extends IQuizDocumentLogEntry {
	kind: 'changed';
	edit: IQuizSerializedEdit;
	v: number;
	metadata?: IQuizChangedMetadata;
}

/** Document focus changed. Aligned with Copilot's DocumentFocusChangedLogEntry. */
export interface IQuizDocumentFocusChangedLogEntry extends IQuizDocumentLogEntry {
	kind: 'focused';
}

/** Document selection changed. Aligned with Copilot's DocumentSelectionChangedLogEntry. */
export interface IQuizDocumentSelectionChangedLogEntry extends IQuizDocumentLogEntry {
	kind: 'selectionChanged';
	selection: IQuizSerializedOffsetRange[];
}

/** Document encountered (discovered but not opened). Aligned with Copilot's DocumentEncounteredLogEntry. */
export interface IQuizDocumentEncounteredLogEntry extends IQuizDocumentLogEntry {
	kind: 'documentEncountered';
	relativePath: string;
}

/** Document event (generic). Aligned with Copilot's DocumentEventLogEntry. */
export interface IQuizDocumentEventLogEntry extends IQuizDocumentLogEntry {
	kind: 'documentEvent';
	data: unknown;
}

/** Generic event. Aligned with Copilot's EventLogEntry. */
export interface IQuizEventLogEntry {
	kind: 'event';
	time: number;
	data: unknown;
}

/** Meta event. Aligned with Copilot's MetaLogEntry. */
export interface IQuizMetaLogEntry {
	kind: 'meta';
	data: unknown | { repoRootUri: string };
}

/** Bookmark event. Aligned with Copilot's BookmarkLogEntry. */
export interface IQuizBookmarkLogEntry {
	kind: 'bookmark';
	time: number;
}

// #endregion

// #region Changed metadata (aligned with Copilot's IChangedMetadata)

export type IQuizChangedMetadata = Record<string, unknown>;

// #endregion

// #region Serialized edit types (aligned with Copilot's ISerializedOffsetRange / ISerializedEdit)

/**
 * Serialized offset range as [start, endExclusive] tuple.
 * Aligned with Copilot's ISerializedOffsetRange.
 */
export type IQuizSerializedOffsetRange = [start: number, endEx: number];

/**
 * Serialized edit as array of [start, endExclusive, newText] tuples.
 * Aligned with Copilot's ISerializedEdit.
 */
export type IQuizSerializedEdit = [start: number, endEx: number, text: string][];

// #endregion

// #region DocumentEventLogEntry sub-types (aligned with Copilot's DocumentEventLogEntryData)

export type IQuizDocumentEventLogEntryData = IQuizDocumentEventDataSetChangeReason | IQuizDocumentEventFetchStart;
export type IQuizEventLogEntryData = IQuizEventFetchEnd;

export interface IQuizDocumentEventDataSetChangeReason {
	sourceId: 'TextModel.setChangeReason';
	source: string;
	v: number;
}

interface IQuizDocumentEventFetchStart {
	sourceId: 'InlineCompletions.fetch';
	kind: 'start';
	requestId: number;
	v: number;
}

export interface IQuizEventFetchEnd {
	sourceId: 'InlineCompletions.fetch';
	kind: 'end';
	requestId: number;
	error: string | undefined;
	result: IQuizFetchResult[];
}

interface IQuizFetchResult {
	range: string;
	text: string;
	isInlineEdit: boolean;
	source: string;
}

// #endregion
