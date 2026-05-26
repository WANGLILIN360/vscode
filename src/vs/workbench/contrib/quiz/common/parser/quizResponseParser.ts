/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuizResponseDelta } from '../endpoint/quizEndpoint.js';

export const IQuizResponseParser = Symbol('IQuizResponseParser');

export interface IQuizResponseParser {
	parseStream(chunk: IQuizResponseDelta): IQuizParsedChunk;
}

export interface IQuizParsedChunk {
	readonly text?: string;
	readonly toolCalls?: unknown[];
	readonly isComplete: boolean;
}
