/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQuizResponseDelta } from '../../common/endpoint/quizEndpoint.js';
import { IQuizParsedChunk, IQuizResponseParser } from '../../common/parser/quizResponseParser.js';

export class QuizNativeCodeParser implements IQuizResponseParser {

	parseStream(chunk: IQuizResponseDelta): IQuizParsedChunk {
		// Native parser can use Node.js APIs for more complex parsing
		return {
			text: chunk.text,
			toolCalls: chunk.toolCalls ? [...chunk.toolCalls] : undefined,
			isComplete: chunk.finishReason === 'stop',
		};
	}
}
