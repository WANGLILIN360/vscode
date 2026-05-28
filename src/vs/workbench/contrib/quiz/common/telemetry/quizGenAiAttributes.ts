/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// #region Quiz GenAI Semantic Attributes (aligned with Copilot's genAiAttributes.ts)
//
// These attribute keys follow the OpenTelemetry GenAI semantic conventions:
// https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md
//
// Quiz uses VS Code's ITelemetryService for emission, so these are plain
// string constants (not OTel Span attributes). They are used as property
// keys in telemetry events to maintain semantic alignment with Copilot.

// #region GenAiOperationName (aligned with Copilot's GenAiOperationName)

/** gen_ai.operation.name values */
export const QuizGenAiOperationName = {
	CHAT: 'chat',
	INVOKE_AGENT: 'invoke_agent',
	EXECUTE_TOOL: 'execute_tool',
	EMBEDDINGS: 'embeddings',
	/** Extension-specific: standalone markdown content event */
	CONTENT_EVENT: 'content_event',
	/** Extension-specific: hook command execution */
	EXECUTE_HOOK: 'execute_hook',
} as const;

// #endregion

// #region GenAiProviderName (aligned with Copilot's GenAiProviderName)

/** gen_ai.provider.name values */
export const QuizGenAiProviderName = {
	GITHUB: 'github',
	OPENAI: 'openai',
	ANTHROPIC: 'anthropic',
	AZURE_AI_OPENAI: 'azure.ai.openai',
	GEMINI: 'gemini',
} as const;

// #endregion

// #region GenAiTokenType (aligned with Copilot's GenAiTokenType)

/** gen_ai.token.type values */
export const QuizGenAiTokenType = {
	INPUT: 'input',
	OUTPUT: 'output',
} as const;

// #endregion

// #region GenAiToolType (aligned with Copilot's GenAiToolType)

/** gen_ai.tool.type values */
export const QuizGenAiToolType = {
	FUNCTION: 'function',
	EXTENSION: 'extension',
} as const;

// #endregion

// #region QuizGenAiAttr (aligned with Copilot's GenAiAttr)

/**
 * OTel GenAI semantic convention attribute keys.
 * Used as property keys in Quiz telemetry events.
 * Aligned with Copilot's GenAiAttr (platform/otel/common/genAiAttributes.ts).
 */
export const QuizGenAiAttr = {
	// Core
	OPERATION_NAME: 'gen_ai.operation.name',
	PROVIDER_NAME: 'gen_ai.provider.name',

	// Request
	REQUEST_MODEL: 'gen_ai.request.model',
	REQUEST_TEMPERATURE: 'gen_ai.request.temperature',
	REQUEST_MAX_TOKENS: 'gen_ai.request.max_tokens',
	REQUEST_TOP_P: 'gen_ai.request.top_p',
	REQUEST_FREQUENCY_PENALTY: 'gen_ai.request.frequency_penalty',
	REQUEST_PRESENCE_PENALTY: 'gen_ai.request.presence_penalty',
	REQUEST_SEED: 'gen_ai.request.seed',
	REQUEST_STOP_SEQUENCES: 'gen_ai.request.stop_sequences',

	// Response
	RESPONSE_MODEL: 'gen_ai.response.model',
	RESPONSE_ID: 'gen_ai.response.id',
	RESPONSE_FINISH_REASONS: 'gen_ai.response.finish_reasons',

	// Usage
	USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
	USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
	USAGE_CACHE_READ_INPUT_TOKENS: 'gen_ai.usage.cache_read.input_tokens',
	USAGE_CACHE_CREATION_INPUT_TOKENS: 'gen_ai.usage.cache_creation.input_tokens',
	USAGE_REASONING_TOKENS: 'gen_ai.usage.reasoning_tokens',
	USAGE_REASONING_OUTPUT_TOKENS: 'gen_ai.usage.reasoning.output_tokens',

	// Conversation
	CONVERSATION_ID: 'gen_ai.conversation.id',
	OUTPUT_TYPE: 'gen_ai.output.type',

	// Token type (for metrics)
	TOKEN_TYPE: 'gen_ai.token.type',

	// Agent
	AGENT_NAME: 'gen_ai.agent.name',
	AGENT_ID: 'gen_ai.agent.id',
	AGENT_VERSION: 'gen_ai.agent.version',
	AGENT_DESCRIPTION: 'gen_ai.agent.description',

	// Tool
	TOOL_NAME: 'gen_ai.tool.name',
	TOOL_TYPE: 'gen_ai.tool.type',
	TOOL_CALL_ID: 'gen_ai.tool.call.id',
	TOOL_DESCRIPTION: 'gen_ai.tool.description',
	TOOL_CALL_ARGUMENTS: 'gen_ai.tool.call.arguments',
	TOOL_CALL_RESULT: 'gen_ai.tool.call.result',

	// Content (opt-in)
	INPUT_MESSAGES: 'gen_ai.input.messages',
	OUTPUT_MESSAGES: 'gen_ai.output.messages',
	SYSTEM_INSTRUCTIONS: 'gen_ai.system_instructions',
	TOOL_DEFINITIONS: 'gen_ai.tool.definitions',
} as const;

// #endregion

// #region QuizChatAttr (aligned with Copilot's CopilotChatAttr)

/**
 * Quiz-specific attribute keys (custom namespace).
 * Aligned with Copilot's CopilotChatAttr (platform/otel/common/genAiAttributes.ts).
 */
export const QuizChatAttr = {
	LOCATION: 'quiz_chat.location',
	INTENT: 'quiz_chat.intent',
	TURN_INDEX: 'quiz_chat.turn.index',
	TURN_COUNT: 'quiz_chat.turn_count',
	TOOL_CALL_ROUND: 'quiz_chat.tool_call_round',
	API_TYPE: 'quiz_chat.api_type',
	FETCHER: 'quiz_chat.fetcher',
	DEBUG_NAME: 'quiz_chat.debug_name',
	ENDPOINT_TYPE: 'quiz_chat.endpoint_type',
	MAX_PROMPT_TOKENS: 'quiz_chat.request.max_prompt_tokens',
	TIME_TO_FIRST_TOKEN: 'quiz_chat.time_to_first_token',
	SESSION_ID: 'quiz_chat.session_id',
	SERVER_REQUEST_ID: 'quiz_chat.server_request_id',
	CANCELED: 'quiz_chat.canceled',
	/** Extended thinking/reasoning content (content-gated) */
	REASONING_CONTENT: 'quiz_chat.reasoning_content',
	/** User's actual typed message text */
	USER_REQUEST: 'quiz_chat.user_request',
	/** Cache-relevant request options as a JSON blob */
	REQUEST_OPTIONS: 'quiz_chat.request.options',
	/** Request-shape metadata as a JSON blob */
	REQUEST_SHAPE: 'quiz_chat.request.shape',
	/** Resolved context section */
	PROMPT_CONTEXT: 'quiz_chat.prompt_context',
	/** Custom instructions section */
	PROMPT_INSTRUCTIONS: 'quiz_chat.prompt_instructions',
	/** VS Code chat session ID from QuizCapturingToken */
	CHAT_SESSION_ID: 'quiz_chat.chat_session_id',
	/** Parent chat session ID for linking child sessions */
	PARENT_CHAT_SESSION_ID: 'quiz_chat.parent_chat_session_id',
	/** Debug log label for child sessions */
	DEBUG_LOG_LABEL: 'quiz_chat.debug_log_label',
	/** Edit source */
	EDIT_SOURCE: 'quiz_chat.edit.source',
	/** Edit outcome */
	EDIT_OUTCOME: 'quiz_chat.edit.outcome',
	/** Language identifier of the document */
	LANGUAGE_ID: 'quiz_chat.language_id',
	/** Hook type / event name */
	HOOK_TYPE: 'quiz_chat.hook_type',
	/** Hook command input (truncated) */
	HOOK_INPUT: 'quiz_chat.hook_input',
	/** Hook command output (truncated) */
	HOOK_OUTPUT: 'quiz_chat.hook_output',
	/** Hook result kind */
	HOOK_RESULT_KIND: 'quiz_chat.hook_result_kind',
	/** Custom chat mode name */
	MODE_NAME: 'quiz_chat.mode_name',
} as const;

// #endregion

// #region QuizStdAttr (aligned with Copilot's StdAttr)

/**
 * Standard OTel attributes used alongside GenAI attributes.
 */
export const QuizStdAttr = {
	ERROR_TYPE: 'error.type',
	SERVER_ADDRESS: 'server.address',
	SERVER_PORT: 'server.port',
} as const;

// #endregion

// #region Type aliases (aligned with Copilot's type aliases)

export type QuizEditSource = 'inline_chat' | 'chat_editing' | 'chat_editing_hunk' | 'apply_patch' | 'replace_string' | 'code_mapper';
export type QuizEditOutcome = 'accepted' | 'rejected' | 'saved' | 'unknown';
export type QuizAgentType = 'builtin' | 'plugin' | 'custom';
export type QuizHookDecision = 'block' | 'approve' | 'non_blocking_error' | 'pass';

// #endregion

// #region Tool name sets for telemetry parameter extraction (aligned with Copilot's SHELL_TOOL_NAMES / FILE_TOOL_NAMES)

/** Tool names treated as shell-command tools for parameter extraction. */
export const QUIZ_SHELL_TOOL_NAMES: ReadonlySet<string> = new Set([
	'bash',
	'powershell',
	'local_shell',
	'runInTerminal',
	'run_in_terminal',
	'core_run_in_terminal',
]);

/** Tool names treated as file tools for parameter extraction. */
export const QUIZ_FILE_TOOL_NAMES: ReadonlySet<string> = new Set([
	'view',
	'create',
	'edit',
	'str_replace',
	'insert',
	'readFile',
	'createFile',
	'replaceString',
	'applyPatch',
	'read_file',
	'create_file',
	'apply_patch',
	'insert_edit_into_file',
	'replace_string_in_file',
	'multi_replace_string_in_file',
	'edit_notebook_file',
]);

/** Max length for the tool.parameters.command attribute. */
export const QUIZ_TOOL_PARAM_COMMAND_MAX_LEN = 256;

// #endregion
