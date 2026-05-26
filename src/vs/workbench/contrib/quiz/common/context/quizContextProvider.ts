/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const IQuizContextProvider = Symbol('IQuizContextProvider');

export interface IQuizContextProvider {
	gatherContext(): Promise<IQuizContext>;
}

export interface IQuizContext {
	readonly workspace?: IQuizWorkspaceContext;
	readonly editor?: IQuizEditorContext;
	readonly git?: IQuizGitContext;
	readonly diagnostics?: IQuizDiagnosticsContext;
}

export interface IQuizWorkspaceContext {
	readonly folders: readonly string[];
}

export interface IQuizEditorContext {
	readonly filePath?: string;
	readonly selection?: string;
	readonly languageId?: string;
}

export interface IQuizGitContext {
	readonly branch?: string;
	readonly changes?: readonly string[];
}

export interface IQuizDiagnosticsContext {
	readonly errors?: readonly unknown[];
}
