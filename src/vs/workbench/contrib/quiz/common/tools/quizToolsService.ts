/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuizToolResult, IQuizToolInfo, IQuizToolDefinition } from '../intents/quizIntents.js';
import { IQuizEndpoint } from '../endpoint/quizEndpoint.js';
import { QuizToolName } from './quizToolNames.js';

// #region IQuizToolValidationResult (aligned with Copilot's IToolValidationResult)

/**
 * Result of validating tool input against its JSON schema.
 * Aligned with Copilot's IToolValidationResult.
 */
export type IQuizToolValidationResult = IQuizValidatedToolInput | IQuizToolValidationError;

export interface IQuizValidatedToolInput {
	inputObj: unknown;
}

export interface IQuizToolValidationError {
	error: string;
}

export function isQuizValidatedToolInput(result: IQuizToolValidationResult): result is IQuizValidatedToolInput {
	return 'inputObj' in result;
}

export function isQuizToolValidationError(result: IQuizToolValidationResult): result is IQuizToolValidationError {
	return 'error' in result;
}

// #endregion

// #region IQuizCopilotTool (aligned with Copilot's ICopilotTool)

/**
 * A built-in Quiz tool implementation with optional extensions.
 * Aligned with Copilot's ICopilotTool + ICopilotToolExtension.
 *
 * Built-in tools can provide:
 * - `invoke`: The tool execution handler
 * - `prepareInvocation`: Pre-invocation confirmation
 * - `filterEdits`: Post-edit filtering (for edit tools)
 * - `provideInput`: Programmatic input generation when referenced in a prompt
 * - `resolveInput`: Resolve LLM-generated input before invocation
 * - `alternativeDefinition`: Override tool definition per endpoint (deprecated)
 */
export interface IQuizCopilotTool<T> {
	/** Execute the tool */
	invoke?(parameters: T, context: IQuizToolInvocationContext, token: CancellationToken): Promise<IQuizToolResult>;
	/** Prepare invocation (e.g., show confirmation) */
	prepareInvocation?(parameters: T, token: CancellationToken): Promise<{ confirmationMessages?: { title: string; message: string }; invocationMessage: string }>;
	/** Filter edits before they are applied (for edit tools) */
	filterEdits?(resource: import('../../../../../base/common/uri.js').URI): Promise<{ title: string; message: string } | undefined>;
	/** Provide input when the tool is referenced in a prompt */
	provideInput?(promptContext: unknown): Promise<T | undefined>;
	/** Resolve LLM-generated input before invocation */
	resolveInput?(input: T, promptContext: unknown, mode: QuizCopilotToolMode): Promise<T>;
}

/**
 * Tool mode determining context verbosity.
 * Aligned with Copilot's CopilotToolMode.
 */
export enum QuizCopilotToolMode {
	/** Give a shorter result, agent mode can call again */
	PartialContext,
	/** Give a longer result, one shot */
	FullContext,
}

// #endregion

// #region IQuizModelSpecificTool (aligned with Copilot's ICopilotModelSpecificTool)

/**
 * A model-specific tool that overrides the base tool for a particular model family.
 * Aligned with Copilot's ICopilotModelSpecificTool.
 *
 * When present, this tool should be used instead of the base tool for the given tool name.
 * The base tool must still be registered and enabled in the request.
 */
export interface IQuizModelSpecificTool<T> extends IQuizCopilotTool<T> {
	/** The model family this override applies to */
	readonly targetModelFamily: string;
	/** The base tool name this override replaces */
	readonly baseToolName: string;
	/** The overridden tool definition */
	readonly definition: IQuizToolDefinition;
}

// #endregion

// #region IQuizToolRegistry (aligned with Copilot's ToolRegistry)

/**
 * Registry for built-in Quiz tools and model-specific tool overrides.
 * Aligned with Copilot's ToolRegistry (from tools/common/toolsRegistry.ts).
 */
export interface IQuizToolRegistry {
	/** Register a built-in Quiz tool */
	registerCopilotTool(name: QuizToolName, tool: IQuizCopilotTool<unknown>): IDisposable;
	/** Get a registered built-in tool */
	getCopilotTool(name: string): IQuizCopilotTool<unknown> | undefined;
	/** All registered built-in tools */
	readonly copilotTools: ReadonlyMap<QuizToolName, IQuizCopilotTool<unknown>>;

	/** Register a model-specific tool override */
	registerModelSpecificTool(name: string, tool: IQuizModelSpecificTool<unknown>): IDisposable;
	/** Get all model-specific tool overrides */
	getModelSpecificTools(): readonly { name: string; definition: IQuizToolDefinition; tool: IQuizModelSpecificTool<unknown> }[];
	/** Get model-specific tool override for a given base tool name and model family */
	getModelSpecificTool(baseToolName: string, modelFamily: string): IQuizModelSpecificTool<unknown> | undefined;
}

// #endregion

// #region IQuizOnWillInvokeToolEvent (aligned with Copilot's IOnWillInvokeToolEvent)

export interface IQuizOnWillInvokeToolEvent {
	readonly toolName: string;
}

// #endregion

// #region IQuizToolsService (aligned with Copilot's IToolsService)

export const IQuizToolsService = createDecorator<IQuizToolsService>('quizToolsService');

/**
 * Service for discovering, invoking, and managing tools in the Quiz agent system.
 * Wraps VS Code's ILanguageModelToolsService to provide a Quiz-specific interface.
 * Aligned with Copilot's IToolsService (from tools/common/toolsService.ts).
 */
export interface IQuizToolsService {
	readonly _serviceBrand: undefined;

	// --- Tool discovery (aligned with Copilot's IToolsService.tools / getTool)

	/**
	 * All registered LanguageModelToolInformations (vscode.lm.tools).
	 * Aligned with Copilot's IToolsService.tools.
	 */
	readonly tools: ReadonlyArray<IQuizToolInfo>;

	/**
	 * Built-in Quiz tool implementations.
	 * Aligned with Copilot's IToolsService.copilotTools.
	 */
	readonly copilotTools: ReadonlyMap<QuizToolName, IQuizCopilotTool<unknown>>;

	/**
	 * Model-specific tool overrides. These are NOT included in copilotTools
	 * and may update at runtime.
	 * Aligned with Copilot's IToolsService.modelSpecificTools.
	 */
	readonly modelSpecificTools: readonly { name: string; definition: IQuizToolDefinition; tool: IQuizModelSpecificTool<unknown> }[];

	/**
	 * Get all currently available tools for the given model.
	 */
	getAvailableTools(modelId?: string): IQuizToolInfo[];

	/**
	 * Get tools enabled for a specific request, filtering by request tool references
	 * and endpoint capabilities. Aligned with Copilot's IToolsService.getEnabledTools().
	 */
	getEnabledTools(requestToolNames: readonly string[], modelId?: string): IQuizToolInfo[];

	/**
	 * Get a tool by its ID.
	 * Aligned with Copilot's IToolsService.getTool().
	 */
	getTool(toolId: string): IQuizToolInfo | undefined;

	/**
	 * Get a tool by its UI-visible (contributed) name.
	 * Aligned with Copilot's IToolsService.getToolByToolReferenceName().
	 */
	getToolByToolReferenceName(name: string): IQuizToolInfo | undefined;

	/**
	 * Get a built-in Quiz tool implementation.
	 * Aligned with Copilot's IToolsService.getCopilotTool().
	 */
	getCopilotTool(name: string): IQuizCopilotTool<unknown> | undefined;

	// --- Tool invocation (aligned with Copilot's IToolsService.invokeTool / invokeToolWithEndpoint)

	/**
	 * Invoke a tool and return its result.
	 */
	invokeTool(
		toolId: string,
		parameters: Record<string, unknown>,
		context: IQuizToolInvocationContext,
		token: CancellationToken,
	): Promise<IQuizToolResult>;

	/**
	 * Invoke a tool with endpoint-specific overrides.
	 * Uses model-specific tool implementations when available.
	 * Aligned with Copilot's IToolsService.invokeToolWithEndpoint().
	 */
	invokeToolWithEndpoint(
		toolId: string,
		parameters: Record<string, unknown>,
		context: IQuizToolInvocationContext,
		endpoint: IQuizEndpoint | undefined,
		token: CancellationToken,
	): Promise<IQuizToolResult>;

	// --- Tool validation (aligned with Copilot's IToolsService.validateToolInput)

	/**
	 * Validate tool input against the tool's JSON schema.
	 * Returns a validation result with either the parsed input or an error.
	 * Aligned with Copilot's IToolsService.validateToolInput().
	 */
	validateToolInput(toolId: string, input: string): Promise<IQuizToolValidationResult>;

	/**
	 * Validate a tool name, returning a sanitized version if invalid.
	 * Aligned with Copilot's IToolsService.validateToolName().
	 */
	validateToolName(name: string): string | undefined;

	// --- Events (aligned with Copilot's IToolsService.onWillInvokeTool)

	/**
	 * Fires before a tool is invoked.
	 * Aligned with Copilot's IToolsService.onWillInvokeTool.
	 */
	readonly onWillInvokeTool: Event<IQuizOnWillInvokeToolEvent>;

	/**
	 * Fires when the set of available tools changes.
	 */
	readonly onDidChangeTools: Event<void>;
}

// #endregion

// #region IQuizToolInvocationContext (aligned with Copilot's tool invocation context)

export interface IQuizToolInvocationContext {
	readonly chatSessionId: string;
	readonly requestId: string;
	readonly toolCallId: string;
	/** URI of the chat session resource (aligned with Copilot's invocation.context.sessionResource) */
	readonly sessionResource?: URI;
}

// #endregion

// #region IQuizToolSchemaNormalizer (aligned with Copilot's ToolSchemaNormalizer)

/**
 * Normalizes tool input schemas based on the target model family.
 * Different model families (OpenAI, Anthropic, Gemini) have different
 * requirements for tool schema formats.
 */
export interface IQuizToolSchemaNormalizer {
	normalize(schema: IQuizToolDefinition, modelFamily: string): IQuizToolDefinition;
}

export class QuizToolSchemaNormalizer implements IQuizToolSchemaNormalizer {

	// --- GPT-4o unsupported schema keywords (aligned with Copilot's gpt4oUnsupportedSchemaKeywords)
	private static readonly _gpt4oUnsupportedSchemaKeywords = new Set([
		'minLength', 'maxLength', 'pattern', 'default', 'format',
		'minimum', 'maximum', 'multipleOf', 'patternProperties',
		'unevaluatedProperties', 'propertyNames', 'minProperties',
		'maxProperties', 'unevaluatedItems', 'contains', 'minContains',
		'maxContains', 'minItems', 'maxItems', 'uniqueItems',
	]);

	// --- GPT-4o max description length
	private static readonly _gpt4oMaxStringLength = 1024;

	normalize(schema: IQuizToolDefinition, modelFamily: string): IQuizToolDefinition {
		const normalizedFamily = modelFamily.toLowerCase();

		// Deep-clone the input schema so mutations don't affect the original
		const inputSchema = schema.inputSchema as Record<string, unknown> | undefined;
		if (!inputSchema) {
			return schema;
		}
		const cloned: Record<string, unknown> = JSON.parse(JSON.stringify(inputSchema));

		// --- fn-level rules (aligned with Copilot's fnRules) ---

		// Rule: parameters must be an object with properties if present
		if (cloned && cloned.type !== 'object') {
			// Force to object schema
			cloned.type = 'object';
			cloned.properties = cloned.properties ?? {};
		}
		if (cloned.type === 'object' && !cloned.properties) {
			cloned.properties = {};
		}

		// Rule: description must not be empty
		if (!schema.description) {
			(schema as { description?: string }).description = 'No description provided';
		}

		// --- jsonSchema-level rules (aligned with Copilot's jsonSchemaRules) ---

		// Rule: array type must have items
		this._forEachSchemaNode(cloned, n => {
			if (n && n.type === 'array' && !n.items) {
				throw new Error('tool parameters array type must have items');
			}
		});

		// Rule: GPT-4 — truncate long descriptions
		if (this._isGpt4ish(normalizedFamily)) {
			this._forEachSchemaNode(cloned, n => {
				if (n && typeof n.description === 'string' && n.description.length > QuizToolSchemaNormalizer._gpt4oMaxStringLength) {
					n.description = n.description.substring(0, QuizToolSchemaNormalizer._gpt4oMaxStringLength);
				}
			});
		}

		// Rule: GPT-4 — remove unsupported schema keywords
		if (this._isGpt4ish(normalizedFamily)) {
			this._forEachSchemaNode(cloned, n => {
				if (n && typeof n === 'object') {
					for (const key of Object.keys(n)) {
						if (QuizToolSchemaNormalizer._gpt4oUnsupportedSchemaKeywords.has(key)) {
							delete n[key];
						}
					}
				}
			});
		}

		// Rule: remove unsupported top-level schema keywords (validated fails for both Claude and 4o)
		const unsupported = ['oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else'];
		for (const key of unsupported) {
			if (Object.prototype.hasOwnProperty.call(cloned, key)) {
				delete (cloned as Record<string, unknown>)[key];
			}
		}

		// Rule: filter required properties to only those that exist in properties
		this._forEachSchemaNode(cloned, n => {
			if (n && n.type === 'object' && n.properties && typeof n.properties === 'object' && Array.isArray(n.required)) {
				const props = n.properties as Record<string, unknown>;
				n.required = n.required.filter((key: string) => props[key] !== undefined);
			}
		});

		// Rule: Draft 2020-12 — array items as array → convert to anyOf
		if (this._isDraft2020_12(normalizedFamily)) {
			this._forEachSchemaNode(cloned, n => {
				if (n && n.type === 'array' && Array.isArray(n.items)) {
					n.items = { anyOf: n.items };
				}
			});
		}

		// Rule: Anthropic — add additionalProperties: false on all objects
		if (normalizedFamily === 'anthropic' || normalizedFamily.startsWith('claude')) {
			this._forEachSchemaNode(cloned, n => {
				if (n && n.type === 'object' && !Object.prototype.hasOwnProperty.call(n, 'additionalProperties')) {
					n.additionalProperties = false;
				}
			});
		}

		// Rule: Gemini — remove $defs/definitions, additionalProperties, convert nullable types
		if (normalizedFamily.startsWith('gemini')) {
			this._forEachSchemaNode(cloned, n => {
				if (n && typeof n === 'object') {
					delete n.$defs;
					delete n.definitions;
					delete n.additionalProperties;
				}
				// Convert ["string", "null"] → { type: "string", nullable: true }
				if (n && typeof n === 'object' && Array.isArray(n.type)) {
					const types = n.type as string[];
					const hasNull = types.includes('null');
					const nonNullTypes = types.filter(t => t !== 'null');
					if (hasNull && nonNullTypes.length === 1) {
						n.type = nonNullTypes[0];
						n.nullable = true;
					} else if (hasNull && nonNullTypes.length > 1) {
						n.type = nonNullTypes;
					}
				}
			});
		}

		return { ...schema, inputSchema: cloned };
	}

	// --- Helpers (aligned with Copilot's forEachSchemaNode, isGpt4ish, isDraft2020_12) ---

	private _forEachSchemaNode(input: Record<string, unknown>, fn: (node: Record<string, unknown>) => void): void {
		if (!input || typeof input !== 'object') {
			return;
		}
		fn(input);
		const children: (unknown | unknown[])[] = [
			input.properties ? Object.values(input.properties as Record<string, unknown>) : undefined,
			input.items ? (Array.isArray(input.items) ? input.items : [input.items]) : undefined,
			input.dependencies ? Object.values(input.dependencies as Record<string, unknown>) : undefined,
			input.patternProperties ? Object.values(input.patternProperties as Record<string, unknown>) : undefined,
			input.additionalProperties ? [input.additionalProperties] : undefined,
			input.anyOf ?? undefined,
			input.allOf ?? undefined,
			input.oneOf ?? undefined,
			input.not ?? undefined,
			input.if ?? undefined,
			input.then ?? undefined,
			input.else ?? undefined,
			input.contains ?? undefined,
		];
		for (const child of children) {
			if (child === undefined) { continue; }
			const arr = Array.isArray(child) ? child : [child];
			for (const value of arr) {
				if (value && typeof value === 'object') {
					this._forEachSchemaNode(value as Record<string, unknown>, fn);
				}
			}
		}
	}

	private _isGpt4ish(family: string): boolean {
		return family.startsWith('gpt-4');
	}

	private _isDraft2020_12(family: string): boolean {
		return family.startsWith('gpt-4') || family.startsWith('claude-') || family.startsWith('o4');
	}
}

// #endregion

// #region QuizToolRegistryImpl (aligned with Copilot's ToolRegistry)

/**
 * Default implementation of IQuizToolRegistry.
 * Manages built-in Quiz tools and model-specific tool overrides.
 */
export class QuizToolRegistryImpl extends Disposable implements IQuizToolRegistry {

	private readonly _copilotTools = new Map<QuizToolName, IQuizCopilotTool<unknown>>();
	private readonly _modelSpecificTools = new Map<string, IQuizModelSpecificTool<unknown>>();

	get copilotTools(): ReadonlyMap<QuizToolName, IQuizCopilotTool<unknown>> {
		return this._copilotTools;
	}

	registerCopilotTool(name: QuizToolName, tool: IQuizCopilotTool<unknown>): IDisposable {
		this._copilotTools.set(name, tool);
		return { dispose: () => this._copilotTools.delete(name) };
	}

	getCopilotTool(name: string): IQuizCopilotTool<unknown> | undefined {
		return this._copilotTools.get(name as QuizToolName);
	}

	registerModelSpecificTool(name: string, tool: IQuizModelSpecificTool<unknown>): IDisposable {
		const key = `${name}::${tool.targetModelFamily}`;
		this._modelSpecificTools.set(key, tool);
		return { dispose: () => this._modelSpecificTools.delete(key) };
	}

	getModelSpecificTools(): readonly { name: string; definition: IQuizToolDefinition; tool: IQuizModelSpecificTool<unknown> }[] {
		return [...this._modelSpecificTools.entries()].map(([key, tool]) => ({
			name: key.split('::')[0],
			definition: tool.definition,
			tool,
		}));
	}

	getModelSpecificTool(baseToolName: string, modelFamily: string): IQuizModelSpecificTool<unknown> | undefined {
		const key = `${baseToolName}::${modelFamily}`;
		return this._modelSpecificTools.get(key);
	}

	override dispose(): void {
		super.dispose();
		this._copilotTools.clear();
		this._modelSpecificTools.clear();
	}
}

// #endregion

// #region NullQuizToolsService

/**
 * Null implementation that returns no tools.
 */
export class NullQuizToolsService implements IQuizToolsService {
	declare readonly _serviceBrand: undefined;
	readonly onDidChangeTools = Event.None;
	readonly onWillInvokeTool = Event.None;
	readonly tools: readonly IQuizToolInfo[] = [];
	readonly copilotTools = new Map<QuizToolName, IQuizCopilotTool<unknown>>();
	readonly modelSpecificTools: readonly { name: string; definition: IQuizToolDefinition; tool: IQuizModelSpecificTool<unknown> }[] = [];

	getAvailableTools(_modelId?: string): IQuizToolInfo[] { return []; }
	getEnabledTools(_requestToolNames: readonly string[], _modelId?: string): IQuizToolInfo[] { return []; }
	getTool(_toolId: string): IQuizToolInfo | undefined { return undefined; }
	getToolByToolReferenceName(_name: string): IQuizToolInfo | undefined { return undefined; }
	getCopilotTool(_name: string): IQuizCopilotTool<unknown> | undefined { return undefined; }

	async invokeTool(_toolId: string, _parameters: Record<string, unknown>, _context: IQuizToolInvocationContext, _token: CancellationToken): Promise<IQuizToolResult> {
		throw new Error('NullQuizToolsService: no tools available');
	}

	async invokeToolWithEndpoint(_toolId: string, _parameters: Record<string, unknown>, _context: IQuizToolInvocationContext, _endpoint: IQuizEndpoint | undefined, _token: CancellationToken): Promise<IQuizToolResult> {
		throw new Error('NullQuizToolsService: no tools available');
	}

	validateToolInput(_toolId: string, _input: string): Promise<IQuizToolValidationResult> { return Promise.resolve({ inputObj: {} }); }
	validateToolName(name: string): string | undefined { return name; }
}

// #endregion
