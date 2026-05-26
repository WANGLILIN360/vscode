/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChatAgentRequest } from '../../../chat/common/participants/chatAgents.js';
import { ChatRequestEditedFileEventKind } from '../../../chat/common/model/chatModel.js';
import { URI } from '../../../../../base/common/uri.js';
import { IQuizChatResult, IQuizChatVariablesCollection, IQuizConversation, IQuizContextManagementResponse, IQuizConversationTokenUsage, IQuizEditedFileEvent, IQuizModeInstruction, IQuizPromptReference, IQuizResultMetadata, IQuizThinkingData, IQuizToolCall, IQuizToolCallRound, IQuizTurn, IQuizTurnRequest, IQuizTurnResponse, IQuizTurnResponseMessage, QuizChatVariablesCollection, QuizEditedFileEventKind, QuizTurnStatus } from '../intents/quizIntents.js';
import { IQuizInternalToolReference } from './quizToolReferences.js';
import { isQuizContinueOnError, isQuizSwitchToAutoOnRateLimit, isQuizToolCallLimitAcceptance } from './quizSpecialRequests.js';

// --- PromptMetadata (aligned with Copilot's PromptMetadata)

export abstract class QuizPromptMetadata {
	readonly _marker: undefined;
	toString(): string {
		return Object.getPrototypeOf(this).constructor.name;
	}
}

// --- Turn metadata classes (aligned with Copilot's conversation metadata)

export class QuizRenderedUserMessageMetadata extends QuizPromptMetadata {
	constructor(
		readonly renderedUserMessage: unknown[],
	) { super(); }
}

export class QuizGlobalContextMessageMetadata extends QuizPromptMetadata {
	constructor(
		readonly renderedGlobalContext: unknown[],
		readonly cacheKey: string,
	) { super(); }
}

export class QuizCustomizationsIndexMetadata extends QuizPromptMetadata {
	constructor(
		readonly value: string,
		readonly toolReferences: readonly unknown[] | undefined,
		readonly cacheKey: string,
	) { super(); }
}

export class QuizTurnTokenUsageMetadata extends QuizPromptMetadata {
	constructor(
		readonly promptTokens: number,
		readonly outputTokens: number,
	) { super(); }
}

// --- IntentInvocationMetadata (aligned with Copilot's IntentInvocationMetadata)

export class QuizIntentInvocationMetadata extends QuizPromptMetadata {
	constructor(
		readonly value: { readonly intent: string; readonly command?: string },
	) { super(); }
}

// --- RequestDebugInformation (aligned with Copilot's RequestDebugInformation)

export class QuizRequestDebugInformation extends QuizPromptMetadata {
	constructor(
		readonly uri: URI,
		readonly intentId: string,
		readonly languageId: string,
		readonly initialDocumentText: string,
		readonly userPrompt: string,
	) { super(); }
}

// --- promptResultMetadata helper (aligned with Copilot's promptResultMetadata)

export type QuizMetadataMap = {
	get<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T | undefined;
	getAll<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T[];
};

export function quizPromptResultMetadata(metadata: QuizPromptMetadata[]): QuizMetadataMap {
	return {
		get<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T | undefined {
			return metadata.find(m => m instanceof key) as T | undefined;
		},
		getAll<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T[] {
			return metadata.filter(m => m instanceof key) as T[];
		}
	};
}

// --- Conversation (aligned with Copilot's Conversation)

export class QuizConversation implements IQuizConversation {

	private readonly _turns: QuizTurnImpl[] = [];
	readonly startTime = Date.now();

	constructor(
		readonly sessionId: string,
	) { }

	get turns(): readonly IQuizTurn[] { return this._turns; }

	addTurn(turn: QuizTurnImpl): void { this._turns.push(turn); }

	getLatestTurn(): QuizTurnImpl | undefined {
		return this._turns[this._turns.length - 1];
	}

	getTokenUsage(): IQuizConversationTokenUsage {
		let totalPromptTokens = 0;
		let totalCompletionTokens = 0;
		let totalCachedTokens = 0;
		for (const turn of this._turns) {
			for (const round of turn.toolCallRounds) {
				if (round.usage) {
					totalPromptTokens += round.usage.promptTokens;
					totalCompletionTokens += round.usage.completionTokens;
					totalCachedTokens += round.usage.cachedTokens ?? 0;
				}
			}
		}
		return { totalPromptTokens, totalCompletionTokens, totalCachedTokens };
	}

	static fromHistory(sessionId: string, entries: readonly IChatAgentRequest[], currentTurn: QuizTurnImpl): QuizConversation {
		const conversation = new QuizConversation(sessionId);
		for (const entry of entries) {
			conversation.addTurn(QuizTurnImpl.fromAgentRequest(entry.requestId, entry));
		}
		conversation.addTurn(currentTurn);
		return conversation;
	}
}

// --- Helper: ChatRequestEditedFileEventKind → QuizEditedFileEventKind

function toQuizEditedFileEventKind(kind: ChatRequestEditedFileEventKind): QuizEditedFileEventKind {
	switch (kind) {
		case ChatRequestEditedFileEventKind.Keep: return QuizEditedFileEventKind.Keep;
		case ChatRequestEditedFileEventKind.Undo: return QuizEditedFileEventKind.Undo;
		case ChatRequestEditedFileEventKind.UserModification: return QuizEditedFileEventKind.UserModification;
	}
}

// --- Turn (aligned with Copilot's Turn)

export class QuizTurnImpl implements IQuizTurn {

	private _references: readonly IQuizPromptReference[] = [];

	private _responseInfo?: { message: IQuizTurnResponseMessage | undefined; status: QuizTurnStatus; responseId: string | undefined; result?: IQuizChatResult };

	private readonly _metadata = new Map<unknown, QuizPromptMetadata[]>();

	/** Summaries applied during the tool-call loop, before setResponse is called. */
	private readonly _pendingSummaries: { toolCallRoundId: string; text: string }[] = [];

	/** Cached synthetic round when no real rounds exist (aligned with Copilot's _filledInMissingRounds). */
	private _filledInMissingRounds: IQuizToolCallRound[] | undefined;

	public readonly startTime = Date.now();

	constructor(
		readonly id: string,
		readonly request: IQuizTurnRequest,
		private readonly _promptVariables: IQuizChatVariablesCollection | undefined = undefined,
		private readonly _toolRefs: readonly IQuizInternalToolReference[] = [],
		readonly editedFileEvents?: IQuizEditedFileEvent[],
		readonly acceptedConfirmationData?: unknown[],
		readonly isContinuation: boolean = false,
		readonly modeInstructions?: readonly IQuizModeInstruction[],
	) { }

	// --- request-derived getters

	get promptVariables(): IQuizChatVariablesCollection | undefined {
		return this._promptVariables ?? this.request.promptVariables;
	}

	get toolReferences(): readonly IQuizInternalToolReference[] {
		return this._toolRefs.length > 0 ? this._toolRefs : (this.request.toolReferences ?? []);
	}

	get references(): readonly IQuizPromptReference[] {
		return this._references;
	}

	addReferences(newReferences: readonly IQuizPromptReference[]): void {
		this._references = getUniqueQuizReferences([...this._references, ...newReferences]);
	}

	// --- response getters (aligned with Copilot's Turn response accessors)

	get response(): IQuizTurnResponse | undefined {
		if (!this._responseInfo) {
			return undefined;
		}
		return {
			message: this._responseInfo.message!,
			status: this._responseInfo.status,
			responseId: this._responseInfo.responseId,
			result: this._responseInfo.result,
		};
	}

	get responseMessage(): IQuizTurnResponseMessage | undefined {
		return this._responseInfo?.message;
	}

	get responseStatus(): QuizTurnStatus {
		return this._responseInfo?.status ?? QuizTurnStatus.InProgress;
	}

	get responseId(): string | undefined {
		return this._responseInfo?.responseId;
	}

	get responseChatResult(): IQuizChatResult | undefined {
		return this._responseInfo?.result;
	}

	get resultMetadata(): Partial<IQuizResultMetadata> | undefined {
		return this._responseInfo?.result?.metadata;
	}

	get renderedUserMessage(): unknown | undefined {
		return this.resultMetadata?.renderedUserMessage;
	}

	// --- tool call rounds (aligned with Copilot's Turn.rounds)

	get toolCallRounds(): IQuizToolCallRound[] {
		// Return rounds from response metadata if available, otherwise from accumulated rounds
		const metadataRounds = this.resultMetadata?.toolCallRounds;
		if (metadataRounds && metadataRounds.length > 0) {
			return [...metadataRounds];
		}
		return this._accumulatedRounds;
	}

	private readonly _accumulatedRounds: IQuizToolCallRound[] = [];

	get rounds(): readonly IQuizToolCallRound[] {
		const metadata = this.resultMetadata;
		const rounds = metadata?.toolCallRounds;
		if (!rounds || rounds.length === 0) {
			if (this._filledInMissingRounds?.length) {
				return this._filledInMissingRounds;
			}

			// Should always have at least one round
			const response = this.responseMessage?.message ?? '';
			this._filledInMissingRounds = [new QuizToolCallRoundImpl('', response, [], 0, undefined, undefined, undefined, undefined, undefined)];
			return this._filledInMissingRounds;
		}

		return rounds;
	}

	addToolCallRound(round: IQuizToolCallRound): void {
		this._accumulatedRounds.push(round);
	}

	setResponse(status: QuizTurnStatus, message: IQuizTurnResponseMessage, responseId?: string, toolCallRounds?: IQuizToolCallRound[], result?: IQuizChatResult): void {
		if (this._responseInfo?.status === QuizTurnStatus.Cancelled) {
			// The cancelled result can be assigned from inside ToolCallingLoop
			return;
		}

		this._responseInfo = { message, status, responseId, result };
		if (toolCallRounds) {
			this._accumulatedRounds.length = 0;
			this._accumulatedRounds.push(...toolCallRounds);
		}
	}

	addPendingSummary(toolCallRoundId: string, text: string): void {
		this._pendingSummaries.push({ toolCallRoundId, text });
	}

	get pendingSummaries(): readonly { toolCallRoundId: string; text: string }[] {
		return this._pendingSummaries;
	}

	// --- metadata (type-safe, class-key — aligned with Copilot's Turn.getMetadata/setMetadata)

	getMetadata<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T | undefined {
		return this._metadata.get(key)?.at(-1) as T | undefined;
	}

	getAllMetadata<T extends QuizPromptMetadata>(key: new (...args: never[]) => T): T[] | undefined {
		return this._metadata.get(key) as T[] | undefined;
	}

	setMetadata<T extends QuizPromptMetadata>(value: T): void {
		const key = Object.getPrototypeOf(value).constructor;
		const arr = this._metadata.get(key) ?? [];
		arr.push(value);
		this._metadata.set(key, arr);
	}

	// --- factory (aligned with Copilot's Turn.fromRequest)

	static fromAgentRequest(id: string, request: IChatAgentRequest): QuizTurnImpl {
		// Build prompt variables from request variable data
		const promptVariables = request.variables?.variables?.length
			? new QuizChatVariablesCollection(
				request.variables.variables.map(v => ({
					id: (v as { id: string }).id ?? '',
					name: (v as { name?: string }).name ?? '',
					value: (v as { value: unknown }).value,
					range: (v as { range?: [number, number] }).range,
				}))
			)
			: undefined;

		// Build tool references from request (IChatAgentRequest doesn't have toolReferences directly,
		// but userSelectedTools maps tool names to enabled state)
		const toolReferences: IQuizInternalToolReference[] = [];
		if (request.userSelectedTools) {
			for (const toolName of Object.keys(request.userSelectedTools)) {
				if (request.userSelectedTools[toolName]) {
					toolReferences.push({ id: toolName, name: toolName });
				}
			}
		}

		// Map edited file events (ChatRequestEditedFileEventKind → QuizEditedFileEventKind)
		const editedFileEvents: IQuizEditedFileEvent[] | undefined =
			request.editedFileEvents?.map(e => ({
				uri: e.uri,
				eventKind: toQuizEditedFileEventKind(e.eventKind),
			}));

		// Compute isContinuation from accepted confirmation data
		const isContinuation = isQuizToolCallLimitAcceptance(request) || isQuizContinueOnError(request) || isQuizSwitchToAutoOnRateLimit(request);

		// Map mode instructions
		const modeInstructions: IQuizModeInstruction[] | undefined =
			request.modeInstructions
				? [{
					uri: request.modeInstructions.uri,
					name: request.modeInstructions.name,
					content: request.modeInstructions.content,
					toolReferences: request.modeInstructions.toolReferences?.map(tr => ({
						id: tr.id,
						name: tr.name,
					})),
					metadata: request.modeInstructions.metadata,
					isBuiltin: request.modeInstructions.isBuiltin,
				}]
				: undefined;

		return new QuizTurnImpl(
			id,
			{
				message: request.message,
				type: 'user',
				promptVariables,
				toolReferences: toolReferences.length > 0 ? toolReferences : undefined,
				editedFileEvents,
				acceptedConfirmationData: request.acceptedConfirmationData,
				isContinuation,
				modeInstructions,
			},
			promptVariables,
			toolReferences,
			editedFileEvents,
			request.acceptedConfirmationData,
			isContinuation,
			modeInstructions,
		);
	}
}

// --- Tool call round (aligned with Copilot's IToolCallRound)

export class QuizToolCallRoundImpl implements IQuizToolCallRound {

	constructor(
		public id: string,
		public response: string,
		public toolCalls: IQuizToolCall[],
		public toolInputRetry: number = 0,
		public summary?: string,
		public timestamp?: number,
		public hookContext?: string,
		public phase?: string,
		public modelId?: string,
		public thinking?: IQuizThinkingData,
		public statefulMarker?: string,
		public compaction?: IQuizContextManagementResponse,
		public usage?: { promptTokens: number; completionTokens: number; cachedTokens?: number },
	) { }
}

// --- getUniqueQuizReferences (aligned with Copilot's getUniqueReferences)

/**
 * Deduplicate and merge overlapping prompt references.
 * Aligned with Copilot's getUniqueReferences in conversation.ts.
 */
export function getUniqueQuizReferences(references: IQuizPromptReference[]): IQuizPromptReference[] {
	const groupedReferences: Map<string, IQuizPromptReference | IQuizPromptReference[]> = new Map();
	const variableReferences: IQuizPromptReference[] = [];

	for (const targetReference of references) {
		const value = targetReference.value;
		// Variable-type references are kept as-is
		if (typeof value === 'string' || (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'variableName'))) {
			variableReferences.push(targetReference);
		} else if (!URI.isUri(value)) {
			// Non-URI, non-variable references — keep unique by id
			groupedReferences.set(targetReference.id, targetReference);
		} else {
			// URI references — group by URI for overlap merging
			const uriKey = value.toString();
			const existing = groupedReferences.get(uriKey);
			if (!existing) {
				groupedReferences.set(uriKey, targetReference);
			} else if (!(existing instanceof Array)) {
				// Replace single entry with array for potential merging
				groupedReferences.set(uriKey, [existing, targetReference]);
			} else {
				existing.push(targetReference);
			}
		}
	}

	// Sort and flatten grouped references
	const finalValues = Array.from(groupedReferences.keys())
		.sort((a, b) => a.localeCompare(b))
		.map(key => {
			const values = groupedReferences.get(key);
			if (Array.isArray(values)) {
				return values;
			}
			return values ? [values] : [];
		})
		.flat();

	return [
		...finalValues,
		...variableReferences,
	];
}

// --- Normalize summaries on rounds (aligned with Copilot's normalizeSummariesOnRounds)

/**
 * Move summaries from metadata onto rounds.
 * This is needed for summaries that were produced for a different turn than the current one,
 * because we can only return resultMetadata from a particular request for the current turn,
 * and can't modify the data for previous turns.
 */
export function normalizeQuizSummariesOnRounds(turns: readonly QuizTurnImpl[]): void {
	for (const [idx, turn] of turns.entries()) {
		// Try persisted summaries from resultMetadata first, fall back to pending
		// summaries that were stored during the tool-call loop (before setResponse).
		const resultMetadata = turn.response?.result?.metadata as Partial<IQuizResultMetadata> | undefined;
		const turnSummaries = resultMetadata?.summaries ?? (resultMetadata?.summary ? [resultMetadata.summary] : turn.pendingSummaries);
		// Each summary supersedes all previous ones, so only the last one matters for restoration
		const turnSummary = turnSummaries.at(-1);
		if (!turnSummary) {
			continue;
		}
		const roundInTurn = turn.toolCallRounds.find(round => round.id === turnSummary.toolCallRoundId);
		if (roundInTurn) {
			roundInTurn.summary = turnSummary.text;
		} else {
			const previousTurns = turns.slice(0, idx);
			for (const prevTurn of previousTurns) {
				const roundInPreviousTurn = prevTurn.toolCallRounds.find(round => round.id === turnSummary.toolCallRoundId);
				if (roundInPreviousTurn) {
					roundInPreviousTurn.summary = turnSummary.text;
					break;
				}
			}
		}
	}
}
