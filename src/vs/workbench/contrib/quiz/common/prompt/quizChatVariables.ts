/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { decodeBase64 } from '../../../../../base/common/buffer.js';
import { localize } from '../../../../../nls.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizChatVariablesCollection, IQuizPromptReference } from '../intents/quizIntents.js';

// #region IQuizPromptVariable (aligned with Copilot's PromptVariable)

/**
 * A resolved prompt variable with its value and metadata.
 * This is the processed form of a ChatPromptReference used during prompt building.
 */
export interface IQuizPromptVariable {
	readonly reference: IQuizPromptReference;
	readonly originalName: string;
	readonly uniqueName: string;
	readonly value: string | URI | IQuizVariableLocation | unknown;
	readonly range?: [start: number, end: number];
	readonly isMarkedReadonly: boolean | undefined;
}

export interface IQuizVariableLocation {
	readonly uri: URI;
	readonly range?: { readonly startLineNumber: number; readonly startColumn: number; readonly endLineNumber: number; readonly endColumn: number };
}

// #endregion

// #region QuizChatVariablesCollectionImpl (aligned with Copilot's ChatVariablesCollection)

/**
 * Full implementation of ChatVariablesCollection with iteration, filtering,
 * merging, and slash command parsing capabilities.
 */
export class QuizChatVariablesCollectionImpl implements IQuizChatVariablesCollection {

	private _variables: IQuizPromptVariable[] | null = null;

	static merge(...collections: QuizChatVariablesCollectionImpl[]): QuizChatVariablesCollectionImpl {
		const allReferences: IQuizPromptReference[] = [];
		const seen = new Set<string>();
		for (const collection of collections) {
			for (const variable of collection) {
				const ref = variable.reference;
				let key: string;
				try {
					key = JSON.stringify(ref.value);
				} catch {
					key = ref.id + String(ref.value);
				}
				if (!seen.has(key)) {
					seen.add(key);
					allReferences.push(ref);
				}
			}
		}
		return new QuizChatVariablesCollectionImpl(allReferences);
	}

	constructor(
		private readonly _source: readonly IQuizPromptReference[] = [],
	) { }

	private _getVariables(): IQuizPromptVariable[] {
		if (!this._variables) {
			this._variables = [];
			for (let i = 0; i < this._source.length; i++) {
				const variable = this._source[i];
				if (variable.value) {
					const originalName = variable.name;
					const uniqueName = this._uniqueFileName(originalName, this._source.slice(0, i));
					this._variables.push({
						reference: variable,
						originalName,
						uniqueName,
						value: variable.value,
						range: variable.range,
						isMarkedReadonly: false,
					});
				}
			}
		}
		return this._variables;
	}

	get references(): readonly IQuizPromptReference[] { return this._source; }
	get size(): number { return this._getVariables().length; }

	add(reference: IQuizPromptReference): void {
		this._variables = null; // invalidate cache
		(this._source as IQuizPromptReference[]).push(reference);
	}

	reverse(): QuizChatVariablesCollectionImpl {
		const sourceCopy = this._source.slice(0);
		sourceCopy.reverse();
		return new QuizChatVariablesCollectionImpl(sourceCopy);
	}

	find(predicate: (v: IQuizPromptVariable) => boolean): IQuizPromptVariable | undefined {
		return this._getVariables().find(predicate);
	}

	filter(predicate: (v: IQuizPromptVariable) => boolean): QuizChatVariablesCollectionImpl {
		const resultingReferences: IQuizPromptReference[] = [];
		for (const variable of this._getVariables()) {
			if (predicate(variable)) {
				resultingReferences.push(variable.reference);
			}
		}
		return new QuizChatVariablesCollectionImpl(resultingReferences);
	}

	hasVariables(): boolean {
		return this._getVariables().length > 0;
	}

	substituteVariablesWithReferences(userQuery: string): string {
		return userQuery;
	}

	/** Iteration support */
	*[Symbol.iterator](): IterableIterator<IQuizPromptVariable> {
		yield* this._getVariables();
	}

	private _uniqueFileName(name: string, variables: readonly IQuizPromptReference[]): string {
		const count = variables.filter(v => v.name === name).length;
		return count === 0 ? name : `${name}-${count}`;
	}
}

// #endregion

// #region Variable type predicates (aligned with Copilot's isPromptFile, isInstructionFile, etc.)

/**
 * ID prefix for prompt file variables.
 */
export const QuizPromptFileIdPrefix = 'vscode.prompt.file';

/**
 * ID prefix for instruction file variables.
 */
export const QuizInstructionFileIdPrefix = 'vscode.instructions.file';

/**
 * ID for customizations index variable.
 */
export const QuizCustomizationsIndexId = 'vscode.customizations.index';

/**
 * Check if provided variable is a "prompt file".
 */
export function isQuizPromptFile(variable: IQuizPromptVariable): variable is IQuizPromptVariable & { value: URI } {
	return variable.reference.id.startsWith(QuizPromptFileIdPrefix);
}

/**
 * Check if provided variable is an "instruction file".
 */
export function isQuizInstructionFile(variable: IQuizPromptVariable): variable is IQuizPromptVariable & { value: URI } {
	return variable.reference.id.startsWith(QuizInstructionFileIdPrefix);
}

/**
 * Check if provided variable is the workspace "customizations index" file.
 */
export function isQuizCustomizationsIndex(variable: IQuizPromptVariable): variable is IQuizPromptVariable & { value: string } {
	return variable.reference.id === QuizCustomizationsIndexId;
}

// #endregion

// #region Session reference types (aligned with Copilot's SessionReferenceSchemes)

/**
 * URI schemes used for chat session references.
 */
export const QuizSessionReferenceSchemes: ReadonlySet<string> = new Set(['vscode-chat-session', 'copilotcli', 'claude-code']);

/**
 * Check if a URI scheme identifies a chat session reference.
 */
export function isQuizSessionReferenceScheme(scheme: string): boolean {
	return QuizSessionReferenceSchemes.has(scheme);
}

/**
 * Check if provided variable is a session reference.
 */
export function isQuizSessionReference(variable: IQuizPromptVariable): variable is IQuizPromptVariable & { value: URI } {
	return URI.isUri(variable.value) && isQuizSessionReferenceScheme((variable.value as URI).scheme);
}

/**
 * Extract the chat session ID string from a session resource URI.
 * Aligned with Copilot's sessionResourceToId.
 *
 * - `vscode-chat-session://local/<base64EncodedSessionId>` — decodes base64
 * - `copilotcli:///<sessionId>` and `claude-code:///<sessionId>` — uses raw path segment
 */
export function quizSessionResourceToId(sessionResource: URI): string {
	const pathSegment = sessionResource.path.replace(/^\//, '').split('/').pop() || '';
	if (!pathSegment) {
		return pathSegment;
	}
	// Only vscode-chat-session URIs use base64-encoded session IDs
	if (sessionResource.scheme === 'vscode-chat-session') {
		try {
			return new TextDecoder().decode(decodeBase64(pathSegment).buffer);
		} catch {
			// Not valid base64 — fall through to raw segment
		}
	}
	return pathSegment;
}

/**
 * Build the attributes for rendering a session reference as an `<attachment>` tag.
 * Aligned with Copilot's sessionReferenceAttachmentAttrs.
 */
export function quizSessionReferenceAttachmentAttrs(variable: IQuizPromptVariable & { value: URI }): Record<string, string> {
	const attrs: Record<string, string> = {};
	if (variable.uniqueName) {
		attrs.id = `${variable.uniqueName} (${quizSessionResourceToId(variable.value)})`;
	}
	attrs.filePath = variable.value.toString();
	return attrs;
}

/**
 * Extract debug-target session IDs from chat prompt references.
 * Aligned with Copilot's extractDebugTargetSessionIds.
 * Returns `undefined` when no session references are present.
 */
export function extractQuizDebugTargetSessionIds(references: readonly IQuizPromptReference[]): readonly string[] | undefined {
	const sessionRefs = references.filter(ref => URI.isUri(ref.value) && isQuizSessionReferenceScheme(ref.value.scheme));
	return sessionRefs.length > 0 ? sessionRefs.map(ref => quizSessionResourceToId(ref.value as URI)) : undefined;
}

// #endregion

// #region cancelText (aligned with Copilot's cancelText)

/**
 * Text shown on the confirmation button when the tool call iteration limit is reached.
 * Aligned with Copilot's cancelText which uses l10n.t('Pause').
 */
export const quizCancelText = () => localize('quiz.toolCallLimit.cancel', 'Pause');

// #endregion

// #region Slash command parsing (aligned with Copilot's parseSlashCommand)

export interface IQuizPromptFileSlashCommandId {
	readonly name: string;
	readonly id: string;
}

export interface IQuizParsedSlashCommand {
	/** The matched prompt file slash command ID. */
	readonly promptFile: IQuizPromptFileSlashCommandId;
	/** The matched IQuizPromptVariable (the prompt file reference). */
	readonly variable: IQuizPromptVariable;
	/** The raw slash command string parsed from the query (without the leading `/`). */
	readonly command: string;
	/** Any trailing arguments after the slash command. */
	readonly args: string;
}

/**
 * Extracts the effective slash command ID and display name for a prompt file variable.
 */
export function getQuizPromptFileSlashCommandId(variable: IQuizPromptVariable): IQuizPromptFileSlashCommandId {
	const name = variable.reference.name;
	const uri = variable.value;
	const pathSegments = URI.isUri(uri) ? uri.path.split('/').filter(Boolean) : [];
	const lastSegment = pathSegments[pathSegments.length - 1];
	const isSkillFile = lastSegment?.toLowerCase() === 'skill.md';
	let id: string;
	if (isSkillFile && pathSegments.length >= 2) {
		id = pathSegments[pathSegments.length - 2];
	} else if (lastSegment?.endsWith('.prompt.md')) {
		id = lastSegment.slice(0, -'.prompt.md'.length);
	} else {
		id = name;
	}
	return { name, id };
}

/**
 * Parses a query for a `/command` pattern and matches it against prompt file references.
 */
export function parseQuizSlashCommand(query: string, chatVariables: QuizChatVariablesCollectionImpl): IQuizParsedSlashCommand | undefined {
	const slashCommandMatch = query.match(/^\s*\/(?<command>\S+)(?:\s+(?<args>.*))?$/s);
	const slashCommand = slashCommandMatch?.groups?.command;
	if (!slashCommand) {
		return undefined;
	}
	const args = slashCommandMatch?.groups?.args?.trim() ?? '';
	for (const variable of chatVariables) {
		if (!isQuizPromptFile(variable)) {
			continue;
		}
		const promptFile = getQuizPromptFileSlashCommandId(variable);
		if (promptFile.id === slashCommand) {
			return { promptFile, variable, command: slashCommand, args };
		}
	}
	return undefined;
}

// #endregion
