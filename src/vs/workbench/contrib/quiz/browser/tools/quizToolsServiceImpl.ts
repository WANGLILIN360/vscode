/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { importAMDNodeModule } from '../../../../../amdX.js';
import { ILanguageModelToolsService, IToolData, IToolInvocation, IToolResult, CountTokensCallback } from '../../../chat/common/tools/languageModelToolsService.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../../../chat/common/languageModels.js';
import { IQuizToolResult, IQuizToolInfo, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolsService, IQuizToolInvocationContext, IQuizToolValidationResult, IQuizOnWillInvokeToolEvent, IQuizCopilotTool, IQuizModelSpecificTool, QuizToolSchemaNormalizer, QuizToolRegistryImpl } from '../../common/tools/quizToolsService.js';
import { IQuizEndpoint } from '../../common/endpoint/quizEndpoint.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';
import { QuizBuiltinToolRegistry } from '../../common/tools/quizBuiltinTools.js';

// Import all built-in tools to trigger self-registration via QuizBuiltinToolRegistry.register()
import '../../common/tools/quizAllTools.js';

// Local interfaces describing the Ajv surface used by QuizToolsServiceImpl.
// Defined at module level to avoid direct ajv imports (not in VS Code allowed list).
interface IQuizAjv {
	compile(schema: Record<string, unknown>): IQuizAjvValidateFunction;
}

interface IQuizAjvValidateFunction {
	(data: unknown): boolean;
	errors?: IQuizAjvError[];
}

interface IQuizAjvError {
	keyword: string;
	params?: { type?: string };
	instancePath: string;
	message?: string;
}

// #region QuizToolsServiceImpl (wraps ILanguageModelToolsService)

export class QuizToolsServiceImpl extends Disposable implements IQuizToolsService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeTools = this._register(new Emitter<void>());
	readonly onDidChangeTools = this._onDidChangeTools.event;

	private readonly _onWillInvokeTool = this._register(new Emitter<IQuizOnWillInvokeToolEvent>());
	readonly onWillInvokeTool = this._onWillInvokeTool.event;

	private readonly _schemaNormalizer = new QuizToolSchemaNormalizer();
	private readonly _toolRegistry = this._register(new QuizToolRegistryImpl());

	// Ajv instance for JSON Schema validation (aligned with Copilot's BaseToolsService)
	// Lazy-loaded via importAMDNodeModule to comply with VS Code layer rules.
	// Uses local IQuizAjv/IQuizAjvValidateFunction interfaces instead of direct ajv imports.
	private readonly _ajvLazy = new (class {
		private _ajv: IQuizAjv | undefined;
		private _schemaCache = new Map<string, IQuizAjvValidateFunction>();
		private _didWarnAboutValidationError?: Set<string>;

		async getAjv(): Promise<IQuizAjv> {
			if (!this._ajv) {
				const ajvModule = await importAMDNodeModule<typeof import('ajv')>('ajv', 'dist/ajv.js');
				this._ajv = new ajvModule.default({ coerceTypes: true }) as IQuizAjv;
			}
			return this._ajv;
		}

		get schemaCache() { return this._schemaCache; }
		get didWarnAboutValidationError() { return this._didWarnAboutValidationError; }
		set didWarnAboutValidationError(v: Set<string> | undefined) { this._didWarnAboutValidationError = v; }
	})();

	constructor(
		@ILanguageModelToolsService private readonly _toolsService: ILanguageModelToolsService,
		@ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._register(this._toolsService.onDidChangeTools(() => this._onDidChangeTools.fire()));

		// Populate the tool registry with all self-registered built-in tools
		// Aligned with Copilot's ToolsContribution pattern
		const builtinDisposables = QuizBuiltinToolRegistry.populateRegistry(this._toolRegistry);
		for (const d of builtinDisposables) {
			this._register(d);
		}
		this._logService.debug(`[QuizToolsService] Registered ${builtinDisposables.length} built-in tools`);
	}

	// --- IQuizToolsService.properties

	get tools(): ReadonlyArray<IQuizToolInfo> {
		return this.getAvailableTools();
	}

	get copilotTools(): ReadonlyMap<QuizToolName, IQuizCopilotTool<unknown>> {
		return this._toolRegistry.copilotTools;
	}

	get modelSpecificTools(): readonly { name: string; definition: IQuizToolDefinition; tool: IQuizModelSpecificTool<unknown> }[] {
		return this._toolRegistry.getModelSpecificTools();
	}

	// --- IQuizToolsService.methods

	getAvailableTools(modelId?: string): IQuizToolInfo[] {
		const model = modelId
			? this._languageModelsService.lookupLanguageModel(modelId)
			: undefined;

		const tools: IQuizToolInfo[] = [];
		for (const toolData of this._toolsService.getTools(model)) {
			tools.push(this._convertToolData(toolData, model));
		}
		return tools;
	}

	getTool(toolId: string): IQuizToolInfo | undefined {
		const toolData = this._toolsService.getTool(toolId);
		return toolData ? this._convertToolData(toolData, undefined) : undefined;
	}

	getToolByToolReferenceName(name: string): IQuizToolInfo | undefined {
		// Try direct lookup first
		const direct = this.getTool(name);
		if (direct) { return direct; }
		// Try matching by contributed name prefix
		for (const tool of this.getAvailableTools()) {
			if (tool.name.endsWith(`_${name}`) || name.endsWith(`_${tool.name}`)) {
				return tool;
			}
		}
		return undefined;
	}

	getCopilotTool(name: string): IQuizCopilotTool<unknown> | undefined {
		return this._toolRegistry.getCopilotTool(name);
	}

	async invokeTool(
		toolId: string,
		parameters: Record<string, unknown>,
		context: IQuizToolInvocationContext,
		token: CancellationToken,
	): Promise<IQuizToolResult> {
		this._onWillInvokeTool.fire({ toolName: toolId });
		this._logService.debug(`[QuizToolsService] Invoking tool: ${toolId}`);

		const invocation: IToolInvocation = {
			callId: context.toolCallId,
			toolId,
			parameters,
			context: {
				sessionResource: undefined as unknown as URI,
			},
			chatRequestId: context.requestId,
		};

		const countTokens: CountTokensCallback = async (input: string, _token: CancellationToken) => {
			return Math.ceil(input.length / 4);
		};

		try {
			const result = await this._toolsService.invokeTool(invocation, countTokens, token);
			return this._convertToolResult(result);
		} catch (err) {
			this._logService.error(`[QuizToolsService] Tool invocation failed for ${toolId}: ${String(err)}`);
			return {
				text: `Tool "${toolId}" failed: ${String(err)}`,
				error: true,
			};
		}
	}

	async invokeToolWithEndpoint(
		toolId: string,
		parameters: Record<string, unknown>,
		context: IQuizToolInvocationContext,
		endpoint: IQuizEndpoint | undefined,
		token: CancellationToken,
	): Promise<IQuizToolResult> {
		// Check for model-specific tool override
		if (endpoint) {
			const modelSpecific = this._toolRegistry.getModelSpecificTool(toolId, endpoint.family);
			if (modelSpecific?.invoke) {
				this._onWillInvokeTool.fire({ toolName: toolId });
				return modelSpecific.invoke(parameters, context, token);
			}
		}
		return this.invokeTool(toolId, parameters, context, token);
	}

	getEnabledTools(requestToolNames: readonly string[], modelId?: string): IQuizToolInfo[] {
		const allTools = this.getAvailableTools(modelId);
		if (requestToolNames.length === 0) {
			return allTools;
		}

		const requestedSet = new Set(requestToolNames);
		return allTools.filter(tool => requestedSet.has(tool.name));
	}

	async validateToolInput(toolId: string, input: string): Promise<IQuizToolValidationResult> {
		// Aligned with Copilot's BaseToolsService.validateToolInput using Ajv.
		const toolInfo = this.getTool(toolId);
		if (!toolInfo) {
			return { error: `ERROR: The tool "${toolId}" does not exist` };
		}

		let inputObj: unknown;
		try {
			inputObj = JSON.parse(input) ?? {};
		} catch (err) {
			if (input) {
				return { error: `ERROR: Your input to the tool was invalid (${String(err)})` };
			}
			inputObj = {};
		}

		if (!toolInfo.inputSchema || Object.keys(toolInfo.inputSchema).length === 0) {
			return { inputObj };
		}

		// Compile and cache the schema validator (aligned with Copilot's schemaCache)
		const ajv = await this._ajvLazy.getAjv();
		let fn = this._ajvLazy.schemaCache.get(toolId);
		if (fn === undefined) {
			try {
				fn = ajv.compile(toolInfo.inputSchema as Record<string, unknown>);
			} catch (e) {
				if (!this._ajvLazy.didWarnAboutValidationError?.has(toolId)) {
					this._ajvLazy.didWarnAboutValidationError ??= new Set();
					this._ajvLazy.didWarnAboutValidationError.add(toolId);
					this._logService.warn(`[QuizToolsService] Error compiling input schema for tool ${toolId}: ${e}`);
				}
				return { inputObj };
			}
			this._ajvLazy.schemaCache.set(toolId, fn);
		}

		return this._ajvValidateForTool(toolId, fn!, inputObj);
	}

	/**
	 * Validate input using Ajv, with auto-parsing of nested JSON strings.
	 * Aligned with Copilot's ajvValidateForTool.
	 */
	private _ajvValidateForTool(toolId: string, fn: IQuizAjvValidateFunction, inputObj: unknown): IQuizToolValidationResult {
		// Empty input can be valid when the schema only has optional properties
		if (fn(inputObj ?? {})) {
			return { inputObj };
		}

		// Check if validation failed because we have JSON strings where objects/arrays are expected
		// (aligned with Copilot's nested JSON string auto-parsing)
		if (fn.errors && typeof inputObj === 'object' && inputObj !== null) {
			let hasNestedJsonStrings = false;
			for (const error of fn.errors) {
				const isObjError = error.keyword === 'type'
					&& (error.params?.type === 'object' || error.params?.type === 'array')
					&& error.instancePath;
				if (!isObjError) {
					continue;
				}

				const pathInfo = this._getObjectPropertyByPath(inputObj, error.instancePath);
				if (pathInfo) {
					const { parent, propertyName } = pathInfo;
					const value = parent[propertyName];

					if (typeof value === 'string') {
						try {
							const parsedValue = JSON.parse(value);
							if (typeof parsedValue === 'object' && parsedValue !== null) {
								parent[propertyName] = parsedValue;
								hasNestedJsonStrings = true;
							}
						} catch {
							// If parsing fails, keep the original value
						}
					}
				}
			}

			if (hasNestedJsonStrings) {
				return this._ajvValidateForTool(toolId, fn, inputObj);
			}
		}

		const errors = fn.errors!.map((e: IQuizAjvError) => e.message || `${e.instancePath} is invalid`);
		return { error: `ERROR: Your input to the tool was invalid (${errors.join(', ')})` };
	}

	/**
	 * Navigate to a property in an object using a JSON Pointer path (RFC6901).
	 * Aligned with Copilot's getObjectPropertyByPath.
	 */
	private _getObjectPropertyByPath(obj: unknown, jsonPointerPath: string): { parent: Record<string, unknown>; propertyName: string } | null {
		const pathSegments = jsonPointerPath.split('/').slice(1); // Remove empty first element from leading '/'

		if (pathSegments.length === 0) {
			return null;
		}

		// Navigate to the parent object
		let current: unknown = obj;
		for (let i = 0; i < pathSegments.length - 1; i++) {
			const segment = pathSegments[i];
			if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, segment)) {
				current = (current as Record<string, unknown>)[segment];
			} else {
				return null;
			}
		}

		if (current && typeof current === 'object') {
			const propertyName = pathSegments[pathSegments.length - 1];
			return { parent: current as Record<string, unknown>, propertyName };
		}

		return null;
	}

	validateToolName(name: string): string | undefined {
		const tool = this.getTool(name);
		if (!tool) {
			return name.replace(/[^\w-]/g, '_');
		}
		return undefined;
	}

	private _convertToolData(data: IToolData, model: ILanguageModelChatMetadata | undefined): IQuizToolInfo {
		const family = model?.vendor ?? 'unknown';
		const definition: IQuizToolDefinition = {
			name: data.id,
			description: data.modelDescription,
			inputSchema: data.inputSchema ?? {},
		};

		const normalized = this._schemaNormalizer.normalize(definition, family);

		return {
			name: data.id,
			description: data.modelDescription,
			inputSchema: normalized.inputSchema,
		};
	}

	private _convertToolResult(result: IToolResult): IQuizToolResult {
		// Extract text content from the tool result
		const textParts: string[] = [];
		for (const part of result.content) {
			if (part.kind === 'text') {
				textParts.push(part.value);
			}
		}

		return {
			text: textParts.join('\n'),
			error: false,
		};
	}
}

// #endregion
