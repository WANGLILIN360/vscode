/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILanguageModelChatMetadata } from '../../../chat/common/languageModels.js';
import { QuizTokenizerType } from '../quizTypes.js';
import type { IQuizEndpointTokenPricing, QuizEndpointEditToolName } from './quizEndpoint.js';
import { isQuizEndpointEditToolName } from './quizEndpoint.js';

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
	readonly supportedEditTools: readonly import('./quizEndpoint.js').QuizEndpointEditToolName[] | undefined;

	// --- Tokenizer (aligned with Copilot's IEndpoint.tokenizer)
	/** Tokenizer type for this model */
	readonly tokenizerType: QuizTokenizerType;

	// --- Pricing (aligned with Copilot's IChatEndpointTokenPricing)
	/** Whether this is a premium model */
	readonly isPremium: boolean | undefined;
	/** Billing multiplier for premium models */
	readonly multiplier: number | undefined;
	/** SKU restrictions for this model */
	readonly restrictedToSkus: readonly string[] | undefined;
	/** Normalized token pricing in AICs per million tokens */
	readonly tokenPricing: IQuizEndpointTokenPricing | undefined;
	/** Price category label */
	readonly priceCategory: string | undefined;
	/** Whether this is a fallback/utility model */
	readonly isFallback: boolean;
}

// #endregion

// #region IQuizModelCapabilityOverride (aligned with Copilot's IModelCapabilityOverride)

/**
 * Per-model capability override. Lets advanced users (and evals) alias an
 * unknown/preview model id to a known production family for capability routing.
 * Aligned with Copilot's IModelCapabilityOverride from chatModelCapabilities.ts.
 *
 * The model id on the wire is unaffected; only the local capability layer
 * sees the alias. This flows through every family-prefix-based heuristic
 * (Anthropic family detection, prompt resolver, multi-replace tools,
 * tool search, context editing, extended cache TTL, etc.).
 */
export interface IQuizModelCapabilityOverride {
	/**
	 * Alias the model's family for capability routing (e.g. set to
	 * `"claude-opus-4.7"` to make a preview model receive every Anthropic
	 * Claude Opus 4.7 capability).
	 */
	readonly family?: string;
}

/**
 * Returns the capability override (if any) for the given model id.
 * Aligned with Copilot's getModelCapabilityOverride() from chatModelCapabilities.ts.
 *
 * Reads from the `quiz.modelCapabilityOverrides` setting, which lets advanced
 * users (and evals) alias an unknown/preview model id to a known production
 * family for capability routing.
 *
 * @param modelId The model identifier to look up overrides for
 * @param overrides The override map from settings (modelId → { family?: string })
 */
export function getQuizModelCapabilityOverride(
	modelId: string,
	overrides?: Record<string, IQuizModelCapabilityOverride>,
): IQuizModelCapabilityOverride | undefined {
	return overrides?.[modelId];
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
		public readonly supportedEditTools: readonly import('./quizEndpoint.js').QuizEndpointEditToolName[] | undefined,
		public readonly tokenizerType: QuizTokenizerType,
		public readonly isPremium: boolean | undefined,
		public readonly multiplier: number | undefined,
		public readonly restrictedToSkus: readonly string[] | undefined,
		public readonly tokenPricing: IQuizEndpointTokenPricing | undefined,
		public readonly priceCategory: string | undefined,
		public readonly isFallback: boolean,
	) { }

	/**
	 * Create QuizModelCapabilities from VS Code's ILanguageModelChatMetadata.
	 * Aligned with Copilot's endpoint capability resolution.
	 */
	static fromMetadata(modelId: string, metadata: ILanguageModelChatMetadata, capabilityOverrides?: Record<string, IQuizModelCapabilityOverride>): QuizModelCapabilities {
		// Apply capability override (aligned with Copilot's ChatEndpoint constructor)
		const capabilityOverride = getQuizModelCapabilityOverride(modelId, capabilityOverrides);
		const family = capabilityOverride?.family ?? metadata.family ?? '';
		const tokenizerType = inferTokenizerType(metadata.vendor, family);
		const normalizedId = normalizeForMatch(modelId);
		const normalizedFamily = normalizeForMatch(family);

		// Infer capabilities from model family patterns
		// Aligned with Copilot's chatModelCapabilities.ts
		const isAnthropic = isQuizAnthropicFamily(family);
		const isGemini = isQuizGeminiFamily(family);

		// Thinking/reasoning: Anthropic Claude 3.5+ and OpenAI o1/o3/o4 support thinking
		const supportsThinkingContentInHistory = isAnthropic
			|| family.startsWith('o1') || family.startsWith('o3') || family.startsWith('o4');
		const supportsAdaptiveThinking = isAnthropic && (
			normalizedFamily.startsWith('claude-3-5') ||
			normalizedFamily.startsWith('claude-3-7') ||
			normalizedFamily.startsWith('claude-4') ||
			normalizedFamily.startsWith('claude-sonnet-4') ||
			normalizedFamily.startsWith('claude-opus-4')
		);
		const minThinkingBudget = supportsAdaptiveThinking ? 1024 : undefined;
		const maxThinkingBudget = supportsAdaptiveThinking ? 16000 : undefined;
		const supportsReasoningEffort = (family.startsWith('o1') || family.startsWith('o3') || family.startsWith('o4'))
			? ['low', 'medium', 'high'] as readonly string[]
			: undefined;

		// Tool search: Claude Sonnet 4.5+/Opus 4.5+ and GPT-5.4/5.5
		const supportsToolSearch = quizModelSupportsToolSearch(normalizedId, normalizedFamily);

		// Context editing: Claude Haiku 4.5, Sonnet 4/4.5/4.6, Opus 4/4.1/4.5/4.6
		const supportsContextEditing = quizModelSupportsContextEditing(normalizedId, normalizedFamily);

		// Prediction: GPT-4o and newer OpenAI models
		const supportsPrediction = family.startsWith('gpt-4o') || family.startsWith('gpt-5') || family.startsWith('o1') || family.startsWith('o3') || family.startsWith('o4');

		// Edit tools: infer from family if not provided by metadata, filtered to known names
		const rawEditTools = metadata.capabilities?.editTools ?? inferEditTools(family, isAnthropic, isGemini);
		const supportedEditTools = rawEditTools?.filter((tool): tool is QuizEndpointEditToolName => isQuizEndpointEditToolName(tool));

		// Image limits: Anthropic 20, Gemini 10
		const maxPromptImages = isAnthropic ? 20 : isGemini ? 10 : undefined;

		// Pricing fields from metadata (aligned with Copilot's IModelBilling)
		const billing = (metadata as Record<string, unknown>).billing as { is_premium?: boolean; multiplier?: number; restricted_to?: string[]; token_prices?: unknown } | undefined;
		const isPremium = billing?.is_premium;
		const multiplier = billing?.multiplier;
		const restrictedToSkus = billing?.restricted_to ? Object.freeze([...billing.restricted_to]) : undefined;
		const tokenPricing = normalizeQuizTokenPricing(billing?.token_prices as IQuizRawModelTokenPrices | undefined);
		const priceCategory = (metadata as Record<string, unknown>).model_picker_price_category as string | undefined;

		return new QuizModelCapabilities(
			modelId,
			metadata.vendor,
			family,
			metadata.version,
			metadata.capabilities?.toolCalling ?? false,
			metadata.capabilities?.vision ?? false,
			typeof metadata.capabilities?.agentMode === 'undefined' || metadata.capabilities.agentMode,
			supportsPrediction,
			supportsThinkingContentInHistory,
			supportsAdaptiveThinking,
			minThinkingBudget,
			maxThinkingBudget,
			supportsReasoningEffort,
			supportsToolSearch,
			supportsContextEditing,
			metadata.maxOutputTokens ?? 4096,
			metadata.maxInputTokens ?? 128000,
			maxPromptImages,
			supportedEditTools,
			tokenizerType,
			isPremium,
			multiplier,
			restrictedToSkus,
			tokenPricing,
			priceCategory,
			(metadata as Record<string, unknown>).is_chat_fallback === true, // isFallback
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
		return !!this.supportedEditTools?.includes(editToolName as QuizEndpointEditToolName);
	}
}

// #endregion

// #region Family-based capability inference (aligned with Copilot's chatModelCapabilities.ts)

/**
 * Normalize a model id or family string for matching.
 * Replaces dots with dashes and lowercases for consistent prefix matching.
 */
function normalizeForMatch(s: string): string {
	return s.toLowerCase().replace(/\./g, '-');
}

/**
 * Check if a model family belongs to Anthropic/Claude.
 * Aligned with Copilot's isAnthropicFamily.
 */
export function isQuizAnthropicFamily(family: string): boolean {
	return family.startsWith('claude') || family.startsWith('Anthropic');
}

/**
 * Check if a model family belongs to Gemini.
 * Aligned with Copilot's isGeminiFamily.
 */
export function isQuizGeminiFamily(family: string): boolean {
	return family.toLowerCase().startsWith('gemini');
}

/**
 * Check if a model supports tool search.
 * Aligned with Copilot's modelSupportsToolSearch.
 *
 * Supported: Claude Sonnet 4.5+/4.6, Opus 4.5+/4.6+/4.7, GPT-5.4/5.5
 */
export function quizModelSupportsToolSearch(normalizedId: string, normalizedFamily: string): boolean {
	const matches = (n: string) =>
		n === 'gpt-5-4' ||
		n === 'gpt-5-5' ||
		n.startsWith('claude-sonnet-4-5') ||
		n.startsWith('claude-sonnet-4-6') ||
		n.startsWith('claude-opus-4-5') ||
		n.startsWith('claude-opus-4-6') ||
		n.startsWith('claude-opus-4-7');
	return matches(normalizedId) || matches(normalizedFamily);
}

/**
 * Check if a model supports context editing (Anthropic context management).
 * Aligned with Copilot's modelSupportsContextEditing.
 *
 * Supported: Claude Haiku 4.5, Sonnet 4/4.5/4.6, Opus 4/4.1/4.5/4.6
 * Not supported: 1M context variants
 */
export function quizModelSupportsContextEditing(normalizedId: string, normalizedFamily: string): boolean {
	// 1M context variant doesn't need context editing
	if (normalizedId.includes('1m') || normalizedFamily.includes('1m')) {
		return false;
	}
	const matches = (n: string) =>
		n.startsWith('claude-haiku-4-5') ||
		n.startsWith('claude-sonnet-4-6') ||
		n.startsWith('claude-sonnet-4-5') ||
		n.startsWith('claude-sonnet-4') ||
		n.startsWith('claude-opus-4-6') ||
		n.startsWith('claude-opus-4-5') ||
		n.startsWith('claude-opus-4-1') ||
		n.startsWith('claude-opus-4');
	return matches(normalizedId) || matches(normalizedFamily);
}

/**
 * Infer supported edit tools from model family.
 * Aligned with Copilot's modelSupportsApplyPatch / modelSupportsReplaceString / modelSupportsMultiReplaceString.
 */
function inferEditTools(family: string, isAnthropic: boolean, isGemini: boolean): string[] | undefined {
	const tools: string[] = [];

	// Anthropic: multi-find-replace (primary) + apply-patch
	if (isAnthropic) {
		tools.push('multi-find-replace', 'apply-patch');
	}
	// Gemini: find-replace (primary) + apply-patch
	else if (isGemini) {
		tools.push('find-replace', 'apply-patch');
	}
	// OpenAI GPT (non-4o): apply-patch
	else if (family.startsWith('gpt') && !family.includes('gpt-4o')) {
		tools.push('apply-patch');
	}
	// OpenAI o4-mini: apply-patch
	else if (family === 'o4-mini') {
		tools.push('apply-patch');
	}
	// GPT-5.x family: apply-patch
	else if (family.startsWith('gpt-5')) {
		tools.push('apply-patch');
	}
	// Default: find-replace as fallback
	else {
		tools.push('find-replace');
	}

	return tools.length > 0 ? tools : undefined;
}

// #endregion

// #region Tokenizer type inference (aligned with Copilot's endpoint tokenizer selection)

/**
 * Infer the tokenizer type from vendor and family.
 * Aligned with Copilot's endpoint tokenizer selection logic.
 */
export { isQuizEndpointEditToolName } from './quizEndpoint.js';

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

// #region Token pricing normalization (aligned with Copilot's normalizeTokenPricing)

/**
 * Raw model token price tier from CAPI billing data.
 * Aligned with Copilot's IModelTokenPriceTier from endpointProvider.ts.
 */
interface IQuizRawModelTokenPriceTier {
	input_price: number;
	output_price: number;
	cache_price: number;
	context_max?: number;
}

/**
 * Raw model token prices from CAPI billing data.
 * Aligned with Copilot's IModelTokenPrices from endpointProvider.ts.
 */
interface IQuizRawModelTokenPrices {
	batch_size: number;
	default: IQuizRawModelTokenPriceTier;
	long_context?: IQuizRawModelTokenPriceTier;
}

const TOKENS_PER_MILLION = 1_000_000;

/**
 * Normalize a single raw price tier into AICs per million tokens.
 * Aligned with Copilot's normalizePriceTier() from chatEndpoint.ts.
 */
function normalizePriceTier(tier: IQuizRawModelTokenPriceTier, scale: number): import('./quizEndpoint.js').IQuizTokenPriceTier {
	return {
		inputPrice: tier.input_price * scale,
		outputPrice: tier.output_price * scale,
		cacheReadTokenPrice: tier.cache_price * scale,
		contextMax: tier.context_max,
	};
}

/**
 * Check if two price tiers have equal rates.
 * Aligned with Copilot's areTierPricesEqual() from chatEndpoint.ts.
 */
function areTierPricesEqual(a: import('./quizEndpoint.js').IQuizTokenPriceTier, b: import('./quizEndpoint.js').IQuizTokenPriceTier): boolean {
	return a.inputPrice === b.inputPrice
		&& a.outputPrice === b.outputPrice
		&& a.cacheReadTokenPrice === b.cacheReadTokenPrice;
}

/**
 * Converts raw billing token prices into normalized AICs per million tokens.
 * Aligned with Copilot's normalizeTokenPricing() from chatEndpoint.ts.
 *
 * The tiered pricing structure (default / long_context) uses AIU values
 * directly, scaled to per-million-token rates based on batch_size.
 * The optional long_context tier is included only when its rates differ
 * from the default tier.
 */
function normalizeQuizTokenPricing(tokenPrices: IQuizRawModelTokenPrices | undefined): IQuizEndpointTokenPricing | undefined {
	if (!tokenPrices) {
		return undefined;
	}
	const scale = TOKENS_PER_MILLION / tokenPrices.batch_size;
	const defaultTier = normalizePriceTier(tokenPrices.default, scale);

	let longContext: import('./quizEndpoint.js').IQuizTokenPriceTier | undefined;
	if (tokenPrices.long_context) {
		const lcTier = normalizePriceTier(tokenPrices.long_context, scale);
		if (!areTierPricesEqual(defaultTier, lcTier)) {
			longContext = lcTier;
		}
	}

	return {
		default: defaultTier,
		longContext,
	};
}

// #endregion

// #region Prompt routing helpers (aligned with Copilot's chatModelCapabilities.ts)

/**
 * Returns whether the instructions should be given in a user message instead
 * of a system message when talking to the model.
 * Aligned with Copilot's modelPrefersInstructionsInUserMessage().
 */
export function quizModelPrefersInstructionsInUserMessage(modelFamily: string): boolean {
	return modelFamily.includes('claude-3.5-sonnet');
}

/**
 * Returns whether the instructions should be presented after the history
 * for the given model.
 * Aligned with Copilot's modelPrefersInstructionsAfterHistory().
 */
export function quizModelPrefersInstructionsAfterHistory(modelFamily: string): boolean {
	return modelFamily.includes('claude-3.5-sonnet');
}

/**
 * Model supports apply_patch as an edit tool.
 * Aligned with Copilot's modelSupportsApplyPatch().
 */
export function quizModelSupportsApplyPatch(family: string): boolean {
	return (family.startsWith('gpt') && !family.includes('gpt-4o'))
		|| family === 'o4-mini'
		|| family.startsWith('gpt-5.2-codex')
		|| family.startsWith('gpt-5.3-codex')
		|| family.startsWith('gpt-5');
}

/**
 * Model supports find-replace (replace_string_in_file) as an edit tool.
 * Aligned with Copilot's modelSupportsReplaceString().
 */
export function quizModelSupportsReplaceString(family: string): boolean {
	return isQuizGeminiFamily(family) || family.includes('grok-code') || quizModelSupportsMultiReplaceString(family) || isQuizMinimaxFamily(family);
}

/**
 * Model supports multi-find-replace (multi_replace_string_in_file) as an edit tool.
 * Aligned with Copilot's modelSupportsMultiReplaceString().
 */
export function quizModelSupportsMultiReplaceString(family: string): boolean {
	return isQuizAnthropicFamily(family) || isQuizMinimaxFamily(family);
}

/**
 * The model is capable of using find-replace exclusively,
 * without needing insert_edit_into_file.
 * Aligned with Copilot's modelCanUseReplaceStringExclusively().
 */
export function quizModelCanUseReplaceStringExclusively(family: string): boolean {
	return isQuizAnthropicFamily(family) || family.includes('grok-code') || family.toLowerCase().includes('gemini-3') || isQuizMinimaxFamily(family);
}

/**
 * We should attempt to automatically heal incorrect edits the model may emit.
 * Aligned with Copilot's modelShouldUseReplaceStringHealing().
 */
export function quizModelShouldUseReplaceStringHealing(family: string): boolean {
	return family.includes('gemini-2');
}

/**
 * The model can accept image urls as the image_url parameter in MCP tool results.
 * Aligned with Copilot's modelCanUseMcpResultImageURL().
 */
export function quizModelCanUseMcpResultImageURL(family: string): boolean {
	return !isQuizAnthropicFamily(family);
}

/**
 * The model supports native PDF document processing via document content parts.
 * Aligned with Copilot's modelSupportsPDFDocuments().
 */
export function quizModelSupportsPDFDocuments(family: string): boolean {
	return isQuizAnthropicFamily(family);
}

/**
 * The model is capable of using apply_patch exclusively,
 * without needing insert_edit_into_file.
 * Aligned with Copilot's modelCanUseApplyPatchExclusively().
 */
export function quizModelCanUseApplyPatchExclusively(family: string): boolean {
	return isQuizGpt5PlusFamily(family);
}

/**
 * Whether, when find-replace and insert_edit tools are both available,
 * verbiage should be added in the system prompt directing the model to prefer
 * find-replace.
 * Aligned with Copilot's modelNeedsStrongReplaceStringHint().
 */
export function quizModelNeedsStrongReplaceStringHint(family: string): boolean {
	return isQuizGeminiFamily(family);
}

/**
 * Model can take the simple, modern apply_patch instructions.
 * Aligned with Copilot's modelSupportsSimplifiedApplyPatchInstructions().
 */
export function quizModelSupportsSimplifiedApplyPatchInstructions(family: string): boolean {
	return isQuizGpt5PlusFamily(family);
}

/**
 * Model prefers JSON notebook representation.
 * Aligned with Copilot's modelPrefersJsonNotebookRepresentation().
 */
export function quizModelPrefersJsonNotebookRepresentation(family: string): boolean {
	return (family.startsWith('gpt') && !family.includes('gpt-4o'))
		|| family === 'o4-mini'
		|| family.startsWith('gpt-5.2-codex')
		|| family.startsWith('gpt-5.3-codex')
		|| family.startsWith('gpt-5');
}

/**
 * Check if a model family belongs to Minimax.
 * Aligned with Copilot's isMinimaxFamily().
 */
export function isQuizMinimaxFamily(family: string): boolean {
	return family.toLowerCase().includes('minimax');
}

/**
 * Check if a model is GPT-5+ family.
 * Aligned with Copilot's isGpt5PlusFamily().
 */
export function isQuizGpt5PlusFamily(family: string): boolean {
	return family.startsWith('gpt-5');
}

/**
 * Check if a model is GPT-5 codex family.
 * Aligned with Copilot's isGptCodexFamily().
 */
export function isQuizGptCodexFamily(family: string): boolean {
	return family.startsWith('gpt-') && family.includes('-codex');
}

/**
 * GPT-5, -mini, -codex, not 5.1+.
 * Aligned with Copilot's isGpt5Family().
 */
export function isQuizGpt5Family(family: string): boolean {
	return family === 'gpt-5' || family === 'gpt-5-mini' || family === 'gpt-5-codex';
}

/**
 * Any GPT family model.
 * Aligned with Copilot's isGptFamily().
 */
export function isQuizGptFamily(family: string): boolean {
	return family.startsWith('gpt-');
}

/**
 * Any GPT-5.1+ model.
 * Aligned with Copilot's isGpt51Family().
 */
export function isQuizGpt51Family(family: string): boolean {
	return family.startsWith('gpt-5.1');
}

/**
 * Returns the verbosity level for a model, taking a sync shortcut.
 * Aligned with Copilot's getVerbosityForModelSync().
 */
export function getQuizVerbosityForModelSync(family: string): 'low' | 'medium' | 'high' | undefined {
	if (family === 'gpt-5.1' || family === 'gpt-5-mini') {
		return 'low';
	}
	return undefined;
}

// #endregion
