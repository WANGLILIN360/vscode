/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's prompt/node/feedbackReporter.ts

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { constObservable, IObservable } from '../../../../../base/common/observable.js';
import { IQuizTurn } from '../intents/quizIntents.js';

export const IQuizFeedbackReporter = createDecorator<IQuizFeedbackReporter>('quizFeedbackReporter');

export interface IQuizFeedbackReporter {
	readonly _serviceBrand: undefined;

	readonly canReport: IObservable<boolean>;

	reportChat(turn: IQuizTurn): Promise<void>;
	reportSearch(kind: QuizSearchFeedbackKind): Promise<void>;
}

export const enum QuizSearchFeedbackKind {
	Positive = 'positive',
	Negative = 'negative',
}

export class NullQuizFeedbackReporterImpl implements IQuizFeedbackReporter {
	_serviceBrand: undefined;

	readonly canReport = constObservable(false);

	async reportChat(): Promise<void> {
		// nothing
	}

	async reportSearch(): Promise<void> {
		// nothing
	}
}

export const NullQuizFeedbackReporter = new NullQuizFeedbackReporterImpl();
