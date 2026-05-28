/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IQuizRange } from '../quizSharedTypes.js';

export const IQuizContextProvider = Symbol('IQuizContextProvider');

export interface IQuizContextProvider {
	gatherContext(): Promise<IQuizContext>;
}

export interface IQuizContext {
	readonly workspace?: IQuizWorkspaceContext;
	readonly editor?: IQuizEditorContext;
	readonly git?: IQuizGitContext;
	readonly diagnostics?: IQuizDiagnosticsContext;
	readonly tabs?: IQuizTabsContext;
}

export interface IQuizWorkspaceContext {
	readonly folders: readonly string[];
	readonly rootUri?: URI;
}

export interface IQuizEditorContext {
	readonly filePath?: string;
	readonly uri?: URI;
	readonly selection?: string;
	readonly selectionRange?: IQuizRange;
	readonly languageId?: string;
	readonly visibleRanges?: readonly IQuizRange[];
	readonly isDirty?: boolean;
}

export interface IQuizGitContext {
	readonly branch?: string;
	readonly changes?: readonly string[];
	readonly isAvailable?: boolean;
}

export interface IQuizDiagnosticsContext {
	readonly errors?: readonly unknown[];
}

export interface IQuizTabsContext {
	readonly openTabs?: readonly IQuizTabContext[];
	readonly activeTab?: IQuizTabContext;
}

export interface IQuizTabContext {
	readonly uri: URI;
	readonly label: string;
	readonly isDirty: boolean;
	readonly isPinned: boolean;
	readonly isPreview: boolean;
}
