/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's edit code step system:
//   extension/intents/node/editCodeStep.ts — EditCodeStep + PreviousEditCodeStep + working set types
//   extension/prompt/common/intents.ts     — IWorkingSet + WorkingSetEntryState
//
// This file provides the common/ layer types for Quiz.
// Pure types — no DI, no platform API (common/ layer).

import { URI } from '../../../../../base/common/uri.js';
import { IQuizBuildPromptContext } from '../intents/quizIntents.js';
import {
	IQuizWorkingSet,
	IQuizWorkingSetEntry,
	QuizWorkingSetEntryState,
	QuizTextDocumentSnapshot,
} from './quizWorkingSet.js';

// Re-export working set types for convenience
export { IQuizWorkingSet, IQuizWorkingSetEntry, QuizWorkingSetEntryState, QuizTextDocumentSnapshot };

// #region Previous edit code step (aligned with Copilot's PreviousEditCodeStep)

/**
 * A previous edit step, used to carry forward state between turns.
 * Aligned with Copilot's PreviousEditCodeStep (extension/intents/node/editCodeStep.ts).
 */
export interface IQuizPreviousEditCodeStep {
	/** The working set from the previous step */
	readonly workingSet: readonly IQuizPreviousWorkingSetEntry[];
	/** The user's request message */
	readonly request: string;
	/** The assistant's reply */
	readonly response: string;
	/** Prompt instruction snapshots from the previous step */
	readonly promptInstructions: readonly IQuizPreviousPromptInstruction[];
}

/**
 * A working set entry from a previous step.
 * Aligned with Copilot's IPreviousWorkingSetEntry.
 */
export interface IQuizPreviousWorkingSetEntry {
	readonly document: { readonly uri: URI; readonly languageId: string; readonly version: number; readonly text: string };
	state: QuizWorkingSetEntryState;
}

/**
 * A prompt instruction from a previous step.
 * Aligned with Copilot's IPreviousPromptInstruction.
 */
export interface IQuizPreviousPromptInstruction {
	readonly document: { readonly uri: URI; readonly version: number; readonly text: string };
}

// #endregion

// #region Edit code step (aligned with Copilot's EditCodeStep)

/**
 * Represents a single edit code step — the state of the working set
 * and edit history for one turn of the edit intent.
 *
 * Aligned with Copilot's EditCodeStep (extension/intents/node/editCodeStep.ts).
 */
export interface IQuizEditCodeStep {
	/** The previous step, if any (null for the first turn) */
	readonly previousStep: IQuizPreviousEditCodeStep | null;
	/** The current working set */
	readonly workingSet: IQuizWorkingSet;
	/** Prompt instruction document snapshots */
	readonly promptInstructions: readonly QuizTextDocumentSnapshot[];
	/** The user message for this step */
	readonly userMessage: string;
	/** The assistant reply for this step */
	readonly assistantReply: string;
	/** Telemetry info about code blocks in the response */
	readonly telemetryInfo: IQuizEditCodeStepTelemetryInfo;

	/** Update the state of a working set entry */
	setWorkingSetEntryState(uri: URI, state: QuizWorkingSetEntryState): void;
}

/**
 * Telemetry info about code blocks in an edit response.
 * Aligned with Copilot's EditCodeStepTelemetryInfo.
 */
export interface IQuizEditCodeStepTelemetryInfo {
	/** URIs of documents referenced in code blocks */
	codeblockUris: Set<string>;
	/** Total number of code blocks in the response */
	codeblockCount: number;
	/** Number of code blocks that have a URI annotation */
	codeblockWithUriCount: number;
	/** Number of code blocks where the code was elided (truncated) */
	codeblockWithElidedCodeCount: number;
}

// #endregion

// #region Edit step build prompt context (aligned with Copilot's IEditStepBuildPromptContext)

/**
 * Extended build prompt context for edit intents, including the working set.
 * Aligned with Copilot's IEditStepBuildPromptContext (extension/intents/node/editCodeStep.ts).
 */
export interface IQuizEditStepBuildPromptContext extends IQuizBuildPromptContext {
	readonly workingSet: IQuizWorkingSet;
	readonly promptInstructions: readonly QuizTextDocumentSnapshot[];
}

// #endregion

// #region Edit history DTO (aligned with Copilot's EditHistoryDTO)

/**
 * Serializable form of edit history for persisting in chat result metadata.
 * Aligned with Copilot's EditHistoryDTO (extension/intents/node/editCodeStep.ts).
 */
export interface IQuizEditHistoryDTO {
	workingSet: IQuizWorkingSetEntryDTO[];
	promptInstructions?: IQuizPromptInstructionsDTO[];
	request: string;
	response: string;
}

/**
 * Serializable form of a working set entry.
 * Aligned with Copilot's WorkingSetEntryDTO.
 */
export interface IQuizWorkingSetEntryDTO {
	uri: URI;
	text: string;
	version: number;
	languageId: string;
	state: number;
}

/**
 * Serializable form of a prompt instruction.
 * Aligned with Copilot's PromptInstructionsDTO.
 */
export interface IQuizPromptInstructionsDTO {
	uri: URI;
	text: string;
	version: number;
}

// #endregion
