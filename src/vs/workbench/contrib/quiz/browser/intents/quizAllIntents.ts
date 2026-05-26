/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuizIntentService } from '../../common/intents/quizIntents.js';
import { QuizAgentIntent } from './quizAgentIntent.js';
import { QuizEditIntent } from './quizEditIntent.js';
import { QuizAskAgentIntent } from './quizAskAgentIntent.js';
import { QuizSearchIntent } from './quizSearchIntent.js';
import { QuizSearchPanelIntent, QuizSearchKeywordsIntent, QuizSemanticSearchIntent } from './quizSearchRelatedIntents.js';
import { QuizExplainIntent } from './quizExplainIntent.js';
import { QuizReviewIntent } from './quizReviewIntent.js';
import { QuizFixIntent } from './quizFixIntent.js';
import { QuizTestsIntent, QuizSetupTestsIntent } from './quizTestsIntent.js';
import { QuizGenerateCodeIntent } from './quizGenerateCodeIntent.js';
import { QuizNewWorkspaceIntent } from './quizNewWorkspaceIntent.js';
import { QuizNewNotebookIntent, QuizNotebookEditorIntent } from './quizNotebookIntents.js';
import { QuizTerminalIntent, QuizTerminalExplainIntent } from './quizTerminalIntents.js';
import { QuizVscodeIntent, QuizInlineChatIntent, QuizEditorIntent, QuizUnknownIntent } from './quizVscodeInlineUnknownIntents.js';

export function registerQuizIntents(
	intentService: IQuizIntentService,
	instantiationService: IInstantiationService,
): void {
	const intents = [
		// Core editing and agent intents
		instantiationService.createInstance(QuizAgentIntent),
		instantiationService.createInstance(QuizEditIntent),
		instantiationService.createInstance(QuizAskAgentIntent),

		// Search intents
		instantiationService.createInstance(QuizSearchIntent),
		instantiationService.createInstance(QuizSemanticSearchIntent),
		instantiationService.createInstance(QuizSearchPanelIntent),
		instantiationService.createInstance(QuizSearchKeywordsIntent),

		// Code assistance intents
		instantiationService.createInstance(QuizExplainIntent),
		instantiationService.createInstance(QuizReviewIntent),
		instantiationService.createInstance(QuizFixIntent),
		instantiationService.createInstance(QuizTestsIntent),
		instantiationService.createInstance(QuizSetupTestsIntent),
		instantiationService.createInstance(QuizGenerateCodeIntent),

		// New/scaffolding intents
		instantiationService.createInstance(QuizNewWorkspaceIntent),
		instantiationService.createInstance(QuizNewNotebookIntent),

		// Terminal intents
		instantiationService.createInstance(QuizTerminalIntent),
		instantiationService.createInstance(QuizTerminalExplainIntent),

		// Notebook intents
		instantiationService.createInstance(QuizNotebookEditorIntent),

		// Inline editor intents
		instantiationService.createInstance(QuizInlineChatIntent),
		instantiationService.createInstance(QuizEditorIntent),

		// VS Code specific
		instantiationService.createInstance(QuizVscodeIntent),

		// Fallback
		instantiationService.createInstance(QuizUnknownIntent),
	];
	for (const intent of intents) {
		intentService.registerIntent(intent);
	}
}
