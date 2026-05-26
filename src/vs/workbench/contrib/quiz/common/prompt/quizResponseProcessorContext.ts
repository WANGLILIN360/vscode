/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/responseProcessorContext.ts

import { IQuizOutcomeAnnotation, IQuizPromptMessage, IQuizResponseProcessorContext, IQuizSessionTurnStorage, IQuizTurn } from '../intents/quizIntents.js';

/**
 * Implementation of IQuizResponseProcessorContext that carries
 * chat session metadata and supports annotation storage.
 */
export class QuizResponseProcessorContext implements IQuizResponseProcessorContext {

	private readonly _annotations: IQuizOutcomeAnnotation[] = [];
	private _inlineSessionStorage?: IQuizSessionTurnStorage;

	constructor(
		public readonly chatSessionId: string,
		public readonly turn: IQuizTurn,
		public readonly messages: readonly IQuizPromptMessage[],
	) { }

	addAnnotations(annotations: IQuizOutcomeAnnotation[]): void {
		this._annotations.push(...annotations);
	}

	getAnnotations(): readonly IQuizOutcomeAnnotation[] {
		return this._annotations;
	}

	storeInInlineSession(store: IQuizSessionTurnStorage): void {
		this._inlineSessionStorage = store;
	}

	getInlineSessionStorage(): IQuizSessionTurnStorage | undefined {
		return this._inlineSessionStorage;
	}
}
