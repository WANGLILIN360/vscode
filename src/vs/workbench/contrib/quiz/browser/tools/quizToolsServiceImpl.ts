/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ILanguageModelToolsService, IToolData, IToolInvocation, IToolResult, CountTokensCallback } from '../../../chat/common/tools/languageModelToolsService.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../../../chat/common/languageModels.js';
import { IQuizToolResult, IQuizToolInfo, IQuizToolDefinition } from '../../common/intents/quizIntents.js';
import { IQuizToolsService, IQuizToolInvocationContext, IQuizToolValidationResult, IQuizOnWillInvokeToolEvent, IQuizCopilotTool, IQuizModelSpecificTool, QuizToolSchemaNormalizer, QuizToolRegistryImpl } from '../../common/tools/quizToolsService.js';
import { IQuizEndpoint } from '../../common/endpoint/quizEndpoint.js';
import { QuizToolName } from '../../common/tools/quizToolNames.js';

// #region QuizToolsServiceImpl (wraps ILanguageModelToolsService)

export class QuizToolsServiceImpl extends Disposable implements IQuizToolsService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeTools = this._register(new Emitter<void>());
	readonly onDidChangeTools = this._onDidChangeTools.event;

	private readonly _onWillInvokeTool = this._register(new Emitter<IQuizOnWillInvokeToolEvent>());
	readonly onWillInvokeTool = this._onWillInvokeTool.event;

	private readonly _schemaNormalizer = new QuizToolSchemaNormalizer();
	private readonly _toolRegistry = this._register(new QuizToolRegistryImpl());

	constructor(
		@ILanguageModelToolsService private readonly _toolsService: ILanguageModelToolsService,
		@ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._register(this._toolsService.onDidChangeTools(() => this._onDidChangeTools.fire()));
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

	validateToolInput(toolId: string, input: string): IQuizToolValidationResult {
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

		// Basic validation: check required properties
		const schema = toolInfo.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
		if (typeof inputObj === 'object' && inputObj !== null && schema.required) {
			for (const key of schema.required) {
				if (!Object.prototype.hasOwnProperty.call(inputObj, key)) {
					return { error: `ERROR: Your input to the tool was invalid (Missing required parameter: ${key})` };
				}
			}
		}

		return { inputObj };
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
