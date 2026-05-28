/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/languageServer/common/languageContextService.ts

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizRange } from '../quizSharedTypes.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region QuizContextKind (aligned with Copilot's ContextKind)

/**
 * Kind of context item returned by the language context service.
 * Aligned with Copilot's ContextKind.
 */
export enum QuizContextKind {
	/** A code snippet extracted from a source file */
	Snippet = 'snippet',
	/** A named trait (key-value pair) */
	Trait = 'trait',
	/** A collection of diagnostics for a resource */
	DiagnosticBag = 'diagnosticBag',
}

// #endregion

// #region Context item types (aligned with Copilot's SnippetContext / TraitContext / DiagnosticBagContext)

/**
 * A context item representing a code snippet extracted from a source file.
 * Aligned with Copilot's SnippetContext.
 */
export interface IQuizSnippetContext {
	kind: QuizContextKind.Snippet;
	/** Unique ID for telemetry */
	id?: string;
	/** Priority in [0, 1] range */
	priority: number;
	/** The source URI */
	uri: URI;
	/** Additional source URIs */
	additionalUris?: URI[];
	/** The snippet text */
	value: string;
}

/**
 * A context item representing a named trait.
 * Aligned with Copilot's TraitContext.
 */
export interface IQuizTraitContext {
	kind: QuizContextKind.Trait;
	/** Unique ID for telemetry */
	id?: string;
	/** Priority in [0, 1] range */
	priority: number;
	/** The trait name */
	name: string;
	/** The trait value */
	value: string;
}

/**
 * A context item representing diagnostics for a resource.
 * Aligned with Copilot's DiagnosticBagContext.
 */
export interface IQuizDiagnosticBagContext {
	kind: QuizContextKind.DiagnosticBag;
	/** Unique ID for telemetry */
	id?: string;
	/** Priority in [0, 1] range */
	priority: number;
	/** The resource URI */
	uri: URI;
	/** The diagnostics */
	values: IQuizContextDiagnostic[];
}

/**
 * A diagnostic item in a DiagnosticBagContext.
 * Simplified version of VS Code's Diagnostic type for common/ layer.
 */
export interface IQuizContextDiagnostic {
	readonly message: string;
	readonly range: IQuizRange;
	readonly severity: number;
	readonly source?: string;
	readonly code?: string | number;
}

/**
 * Union type of all context items.
 * Aligned with Copilot's ContextItem.
 */
export type IQuizContextItem = IQuizSnippetContext | IQuizTraitContext | IQuizDiagnosticBagContext;

// #endregion

// #region QuizKnownSources (aligned with Copilot's KnownSources)

/**
 * Known sources for context requests.
 * Aligned with Copilot's KnownSources.
 */
export enum QuizKnownSources {
	unknown = 'unknown',
	sideCar = 'sideCar',
	completion = 'completion',
	populateCache = 'populateCache',
	nes = 'nes',
	chat = 'chat',
	fix = 'fix',
}

// #endregion

// #region QuizTriggerKind (aligned with Copilot's TriggerKind)

/**
 * Trigger kind for context requests.
 * Aligned with Copilot's TriggerKind.
 */
export enum QuizTriggerKind {
	unknown = 'unknown',
	selection = 'selection',
	completion = 'completion',
}

// #endregion

// #region IQuizRequestContext (aligned with Copilot's RequestContext)

/**
 * Context for a language context request.
 * Aligned with Copilot's RequestContext.
 */
export interface IQuizRequestContext {
	/** Unique request ID */
	requestId: string;
	/** Opportunity ID from VS Code core */
	opportunityId?: string;
	/** Time budget in milliseconds */
	timeBudget?: number;
	/** Token budget for context computation */
	tokenBudget?: number;
	/** Source of the request */
	source?: QuizKnownSources | string;
	/** Trigger kind */
	trigger?: QuizTriggerKind;
	/** Proposed edits to apply before computing context */
	proposedEdits?: { edit: { range: IQuizRange; newText: string }; source?: 'selectedCompletionInfo' }[];
	/** Telemetry sampling rate (1 = every request, 5 = every 5th) */
	sampleTelemetry?: number;
}

// #endregion

// #region IQuizLanguageContextService (aligned with Copilot's ILanguageContextService)

export const IQuizLanguageContextService = createDecorator<IQuizLanguageContextService>('quizLanguageContextService');

/**
 * Language server context service.
 * Provides code context (snippets, traits, diagnostics) from language servers.
 * Aligned with Copilot's ILanguageContextService (platform/languageServer/common/languageContextService.ts).
 *
 * Quiz bridges VS Code's built-in language features (hover, definitions, diagnostics)
 * to provide context for prompt building and tool operations.
 */
export interface IQuizLanguageContextService {
	readonly _serviceBrand: undefined;

	/**
	 * Check whether language server context is activated for a document or language.
	 * Aligned with Copilot's ILanguageContextService.isActivated().
	 *
	 * @param documentOrLanguageId A text document (URI + languageId) or a language ID string
	 */
	isActivated(documentOrLanguageId: IQuizTextDocumentInfo | string): Promise<boolean>;

	/**
	 * Populate the context cache for a document and position.
	 * Aligned with Copilot's ILanguageContextService.populateCache().
	 *
	 * @param document The document to populate the cache for
	 * @param position The position in the document
	 * @param context The request context
	 */
	populateCache(document: IQuizTextDocumentInfo, position: IQuizPosition, context: IQuizRequestContext): Promise<void>;

	/**
	 * Retrieve context items for a document and position.
	 * Aligned with Copilot's ILanguageContextService.getContext().
	 *
	 * @param document The document to retrieve context for
	 * @param position The position in the document
	 * @param context The request context
	 * @param token Cancellation token
	 * @returns An async iterable of context items
	 */
	getContext(document: IQuizTextDocumentInfo, position: IQuizPosition, context: IQuizRequestContext, token: CancellationToken): AsyncIterable<IQuizContextItem>;

	/**
	 * Retrieve context on timeout — returns cached items quickly.
	 * Aligned with Copilot's ILanguageContextService.getContextOnTimeout().
	 *
	 * @param document The document
	 * @param position The position
	 * @param context The request context
	 * @returns Cached context items or undefined
	 */
	getContextOnTimeout(document: IQuizTextDocumentInfo, position: IQuizPosition, context: IQuizRequestContext): readonly IQuizContextItem[] | undefined;
}

// #endregion

// #region Helper types (common/ layer safe alternatives to VS Code types)

/**
 * Text document info for language context requests.
 * Replaces Copilot's use of vscode.TextDocument with a common/-safe type.
 */
export interface IQuizTextDocumentInfo {
	readonly uri: URI;
	readonly languageId: string;
	readonly version: number;
	getText(range?: IQuizRange): string;
}

/**
 * Position in a text document.
 * Replaces Copilot's use of vscode.Position with a common/-safe type.
 */
export interface IQuizPosition {
	readonly lineNumber: number;
	readonly column: number;
}

// #endregion

// #region NullLanguageContextService (aligned with Copilot's NullLanguageContextService)

class EmptyAsyncIterable<T> implements AsyncIterable<T> {
	public async *[Symbol.asyncIterator](): AsyncIterator<T> {
	}
}

/**
 * Null implementation of IQuizLanguageContextService.
 * Aligned with Copilot's NullLanguageContextService.
 */
export const NullQuizLanguageContextService: IQuizLanguageContextService = {
	_serviceBrand: undefined,
	isActivated: async () => false,
	populateCache: async () => { },
	getContext: () => new EmptyAsyncIterable<IQuizContextItem>(),
	getContextOnTimeout: () => [],
};

// #endregion
