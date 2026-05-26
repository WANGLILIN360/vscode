/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import {
	IQuizChatResult,
	IQuizResponsePart,
	IQuizResponseProcessor,
	IQuizResponseProcessorContext,
	IQuizResponseStream,
} from '../../common/intents/quizIntents.js';

export class QuizPseudoStopStartResponseProcessor implements IQuizResponseProcessor {
	async processResponse(
		context: IQuizResponseProcessorContext,
		inputStream: AsyncIterable<IQuizResponsePart>,
		outputStream: IQuizResponseStream,
		token: CancellationToken,
	): Promise<IQuizChatResult | void> {
		let fullText = '';
		for await (const part of inputStream) {
			if (token.isCancellationRequested) {
				break;
			}
			if (part.text) {
				outputStream.markdown(part.text);
				fullText += part.text;
			}
			if (part.toolCalls && part.toolCalls.length > 0) {
				for (const toolCall of part.toolCalls) {
					outputStream.progress(`Calling tool: ${toolCall.name}`);
				}
			}
		}
		return { metadata: { fullResponseText: fullText } };
	}
}
