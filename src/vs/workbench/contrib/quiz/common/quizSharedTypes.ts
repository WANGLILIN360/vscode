/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

// #region Shared basic types (extracted from quizIntents.ts to avoid circular imports)

/**
 * A range in a text document, expressed as (startLineNumber, startColumn) to
 * (endLineNumber, endColumn). Line numbers and columns are 1-based.
 */
export interface IQuizRange {
	readonly startLineNumber: number;
	readonly startColumn: number;
	readonly endLineNumber: number;
	readonly endColumn: number;
}

/**
 * A location in a text document, consisting of a URI and an optional range.
 */
export interface IQuizLocation {
	readonly uri: URI;
	readonly range?: IQuizRange;
}

// #endregion
