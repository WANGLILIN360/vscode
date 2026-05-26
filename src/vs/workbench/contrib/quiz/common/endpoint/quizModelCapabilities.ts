/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILanguageModelChatMetadata } from '../../../chat/common/languageModels.js';
import { QuizTokenizerType } from '../quizTypes.js';

// #region IQuizModelCapabilities (aligned with Copilot's IChatEndpoint capabilities)

/**
 * Describes the capabilities of a language model available to Quiz.
 * Aligned with Copilot's IChatEndpoint capability fields
 * (from platform/networking/common/networking.ts IChatEndpoint).
 *
 * Wraps ILanguageModelChatMetadata.capabilities with Quiz-specific helpers
 * and adds fields Copilot exposes on IChatEndpoint that aren't in
 * ILanguageModelChatMetadata.capabilities.
 */
export interface IQuizModelCapabilities {
	// --- Identity
	/** The model identifier */
	readonly modelId: string;
	/** The model vendor (e.g., 'copilot', 'ollama') */
	readonly vendor: string;
	/** The model family (e.g., 'gpt-4', 'claude-3.5') — use this to switch behavior */
	readonly family: string;
	/** Model version string */
	readonly version: string;

	// --- Core capabilities (aligned with Copilot's IChatEndpoint)
	/** Whether the model supports tool/function calling */
	readonly supportsToolCalls: boolean;
	/** Whether the model supports vision/image input */
	readonly supportsVision: boolean;
	/** Whether the model supports agent mode */
	readonly supportsAgentMode: boolean;
	/** Whether the model supports prediction/assisted generation */
	readonly supportsPrediction: boolean;
	/** Whether the model supports thinking/reasoning content in history */
	readonly supportsThinkingContentInHistory: boolean;
	/** Whether the model supports adaptive thinking */
	readonly supportsAdaptiveThinking: boolean;
	/** Minimum thinking budget (tokens) */
	readonly minThinkingBudget: number | undefined;
	/** Maximum thinking budget (tokens) */
	readonly maxThinkingBudget: number | undefined;
	/** Supported reasoning effort levels */
	readonly supportsReasoningEffort: readonly string[] | undefined;
	/** Whether the model supports tool search (Responses API) */
	readonly supportsToolSearch: boolean;
	/** Whether the model supports context editing */
	readonly supportsContextEditing: boolean;

	// --- Token limits (aligned with Copilot's IEndpoint + IChatEndpoint)
	/** Maximum output tokens the model can produce */
	readonly maxOutputTokens: number;
	/** Maximum input tokens the model can accept */
	readonly maxInputTokens: number;
	/** Maximum number of images in a prompt */
	readonly maxPromptImages: number | undefined;

	// --- Edit tools (aligned with Copilot's EndpointEditToolName)
	/** Edit tools supported by this model (e.g., 'apply-patch', 'find-replace') */
	readonly supportedEditTools: readonly string[] | undefined;

	// --- Tokenizer (aligned with Copilot's IEndpoint.tokenizer)
	/** Tokenizer type for this model */
	readonly tokenizerType: QuizTokenizerType;

	// --- Pricing (aligned with Copilot's IChatEndpointTokenPricing)
	/** Whether this is a premium model */
	readonly isPremium: boolean | undefined;
	/** Price category label */
	readonly priceCategory: string | undefined;
	/** Whether this is a fallback/utility model */
	readonly isFallback: boolean;
}

// #endregion

// #region QuizModelCapabilities (aligned with Copilot's ChatEndpoint)

export class QuizModelCapabilities implements IQuizModelCapabilities {

	constructor(
		public readonly modelId: string,
		public readonly vendor: string,
		public readonly family: string,
		public readonly version: string,
		public readonly supportsToolCalls: boolean,
		public readonly supportsVision: boolean,
		public readonly supportsAgentMode: boolean,
		public readonly supportsPrediction: boolean,
		public readonly supportsThinkingContentInHistory: boolean,
		public readonly supportsAdaptiveThinking: boolean,
		public readonly minThinkingBudget: number | undefined,
		public readonly maxThinkingBudget: number | undefined,
		public readonly supportsReasoningEffort: readonly string[] | undefined,
		public readonly supportsToolSearch: boolean,
		public readonly supportsContextEditing: boolean,
		public readonly maxOutputTokens: number,
		public readonly maxInputTokens: number,
		public readonly maxPromptImages: number | undefined,
		public readonly supportedEditTools: readonly string[] | undefined,
		public readonly tokenizerType: QuizTokenizerType,
		public readonly isPremium: boolean | undefined,
		public readonly priceCategory: string | undefined,
		public readonly isFallback: boolean,
	) { }

	/**
	 * Create QuizModelCapabilities from VS Code's ILanguageModelChatMetadata.
	 * Aligned with Copilot's endpoint capability resolution.
	 */
	static fromMetadata(modelId: string, metadata: ILanguageModelChatMetadata): QuizModelCapabilities {
		const family = metadata.family ?? '';
		const tokenizerType = inferTokenizerType(metadata.vendor, family);

		return new QuizModelCapabilities(
			modelId,
			metadata.vendor,
			family,
			metadata.version,
			metadata.capabilities?.toolCalling ?? false,
			metadata.capabilities?.vision ?? false,
			typeof metadata.capabilities?.agentMode === 'undefined' || metadata.capabilities.agentMode,
			false, // supportsPrediction — not exposed by ILanguageModelChatMetadata
			false, // supportsThinkingContentInHistory — not exposed by ILanguageModelChatMetadata
			false, // supportsAdaptiveThinking — not exposed by ILanguageModelChatMetadata
			undefined, // minThinkingBudget — not exposed
			undefined, // maxThinkingBudget — not exposed
			undefined, // supportsReasoningEffort — not exposed
			false, // supportsToolSearch — not exposed
			false, // supportsContextEditing — not exposed
			metadata.maxOutputTokens ?? 4096,
			metadata.maxInputTokens ?? 128000,
			undefined, // maxPromptImages — not exposed
			metadata.capabilities?.editTools,
			tokenizerType,
			undefined, // isPremium — not exposed
			undefined, // priceCategory — not exposed
			false, // isFallback
		);
	}

	/**
	 * Check if this model is suitable for agent mode (tool calling + agent support).
	 * Aligned with Copilot's ILanguageModelChatMetadata.suitableForAgentMode.
	 */
	isSuitableForAgentMode(): boolean {
		return this.supportsAgentMode && this.supportsToolCalls;
	}

	/**
	 * Check if the model supports any edit tool.
	 */
	isSuitableForEdits(): boolean {
		return !!this.supportedEditTools && this.supportedEditTools.length > 0;
	}

	/**
	 * Get the preferred edit tool for this model.
	 * Returns the first supported edit tool, or undefined.
	 */
	getPreferredEditTool(): string | undefined {
		return this.supportedEditTools?.[0];
	}

	/**
	 * Check if the model supports a specific edit tool name.
	 */
	supportsEditTool(editToolName: string): boolean {
		return !!this.supportedEditTools?.includes(editToolName);
	}
}

// #endregion

// #region Tokenizer type inference (aligned with Copilot's endpoint tokenizer selection)

/**
 * Infer the tokenizer type from vendor and family.
 * Aligned with Copilot's endpoint tokenizer selection logic.
 */
function inferTokenizerType(vendor: string, family: string): QuizTokenizerType {
	if (vendor === 'copilot') {
		// Copilot models use O200K for newer models, CL100K for older
		if (family.startsWith('gpt-4o') || family.startsWith('o1') || family.startsWith('o3') || family.startsWith('o4')) {
			return QuizTokenizerType.O200K;
		}
		if (family.startsWith('gpt-4') || family.startsWith('gpt-3.5')) {
			return QuizTokenizerType.CL100K;
		}
		// Default for unknown Copilot models
		return QuizTokenizerType.O200K;
	}
	if (vendor === 'anthropic' || family.startsWith('claude')) {
		return QuizTokenizerType.Anthropic;
	}
	// Fallback for BYOK and other vendors
	return QuizTokenizerType.CharLevel;
}

// #endregion
