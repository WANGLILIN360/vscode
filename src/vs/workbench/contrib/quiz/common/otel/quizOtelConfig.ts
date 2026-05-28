/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/otel/common/otelConfig.ts
//
// Quiz does NOT ship an OTel SDK (it uses VS Code's ITelemetryService instead).
// This file provides the configuration types and resolver so that:
//   1. Code ported from Copilot can reference OTel config types
//   2. A future OTel integration can use the same config resolution logic
//   3. The Null config (disabled) is always available

// #region QuizOTelExporterType (aligned with Copilot's OTelExporterType)

/**
 * Type of OTel span exporter.
 * Aligned with Copilot's OTelExporterType.
 */
export type QuizOTelExporterType = 'otlp-grpc' | 'otlp-http' | 'console' | 'file';

// #endregion

// #region QuizOTelEnabledVia (aligned with Copilot's OTelEnabledVia)

/**
 * How OTel was enabled — used for telemetry to track adoption channels.
 * Aligned with Copilot's OTelEnabledVia.
 */
export type QuizOTelEnabledVia = 'envVar' | 'setting' | 'otlpEndpointEnvVar' | 'dbSpanExporterOnly' | 'disabled';

// #endregion

// #region QuizOTelConfig (aligned with Copilot's OTelConfig)

/**
 * Resolved OTel configuration (immutable).
 * Aligned with Copilot's OTelConfig (platform/otel/common/otelConfig.ts).
 *
 * Quiz uses this primarily for the `enabled` flag and service identity.
 * The full OTel pipeline (SDK, span processors, exporters) is not included
 * in Quiz — it uses VS Code's ITelemetryService for event emission instead.
 */
export interface IQuizOTelConfig {
	readonly enabled: boolean;
	/** True when OTel was enabled via setting/env var, not just implied by dbSpanExporter. */
	readonly enabledExplicitly: boolean;
	/** How OTel was enabled — used for telemetry to track adoption channels. */
	readonly enabledVia: QuizOTelEnabledVia;
	readonly exporterType: QuizOTelExporterType;
	readonly otlpEndpoint: string;
	readonly otlpProtocol: 'grpc' | 'http';
	readonly captureContent: boolean;
	/**
	 * Maximum size (in characters) for free-form content attributes.
	 * 0 = no truncation (default). Aligned with Copilot's maxAttributeSizeChars.
	 */
	readonly maxAttributeSizeChars: number;
	readonly fileExporterPath?: string;
	readonly dbSpanExporter: boolean;
	readonly logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
	readonly httpInstrumentation: boolean;
	readonly serviceName: string;
	readonly serviceVersion: string;
	readonly sessionId: string;
	readonly resourceAttributes: Record<string, string>;
}

// #endregion

// #region QuizOTelConfigInput (aligned with Copilot's OTelConfigInput)

/**
 * Input for resolving OTel configuration.
 * Aligned with Copilot's OTelConfigInput.
 */
export interface IQuizOTelConfigInput {
	env: Record<string, string | undefined>;
	settingEnabled?: boolean;
	settingExporterType?: QuizOTelExporterType;
	settingOtlpEndpoint?: string;
	settingCaptureContent?: boolean;
	settingMaxAttributeSizeChars?: number;
	settingOutfile?: string;
	settingDbSpanExporter?: boolean;
	extensionVersion: string;
	sessionId: string;
	vscodeTelemetryLevel?: string;
}

// #endregion

// #region Constants

/** Default OTLP endpoint used when no env var or setting overrides it. */
export const QUIZ_DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';

/** Default service name for Quiz OTel. */
export const QUIZ_OTEL_SERVICE_NAME = 'quiz-chat';

// #endregion

// #region resolveQuizOTelConfig (aligned with Copilot's resolveOTelConfig)

/**
 * Resolve OTel configuration with layered precedence:
 * 1. QUIZ_OTEL_* env vars (highest)
 * 2. OTEL_EXPORTER_OTLP_* standard env vars
 * 3. VS Code settings
 * 4. Defaults (lowest)
 *
 * Aligned with Copilot's resolveOTelConfig().
 */
export function resolveQuizOTelConfig(input: IQuizOTelConfigInput): IQuizOTelConfig {
	const { env } = input;

	// Kill switch: respect VS Code telemetry level
	if (input.vscodeTelemetryLevel === 'off') {
		return createQuizDisabledOTelConfig(input);
	}

	// SQLite DB span exporter: setting > default(false)
	const dbSpanExporter = input.settingDbSpanExporter ?? false;

	// Determine if enabled: env > setting > dbSpanExporter > default(false)
	const enabled = (quizEnvBool(env['QUIZ_OTEL_ENABLED'])
		?? input.settingEnabled
		?? (!!env['OTEL_EXPORTER_OTLP_ENDPOINT']))
		|| dbSpanExporter;

	// OTel was explicitly enabled if the user/env turned it on, not just dbSpanExporter
	const enabledExplicitly = (quizEnvBool(env['QUIZ_OTEL_ENABLED'])
		?? input.settingEnabled
		?? (!!env['OTEL_EXPORTER_OTLP_ENDPOINT'])) === true;

	if (!enabled) {
		return createQuizDisabledOTelConfig(input);
	}

	// Determine how OTel was enabled for telemetry tracking
	let enabledVia: QuizOTelEnabledVia;
	if (quizEnvBool(env['QUIZ_OTEL_ENABLED']) === true) {
		enabledVia = 'envVar';
	} else if (input.settingEnabled === true) {
		enabledVia = 'setting';
	} else if (!!env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
		enabledVia = 'otlpEndpointEnvVar';
	} else {
		enabledVia = 'dbSpanExporterOnly';
	}

	// Protocol: env > inferred from exporter type > default
	const rawProtocol = env['OTEL_EXPORTER_OTLP_PROTOCOL'] ?? env['QUIZ_OTEL_PROTOCOL'];
	const protocol: 'grpc' | 'http' = rawProtocol === 'grpc' ? 'grpc' : 'http';

	// Endpoint: QUIZ_OTEL env > OTEL env > setting > default
	const rawEndpoint = env['QUIZ_OTEL_ENDPOINT']
		?? env['OTEL_EXPORTER_OTLP_ENDPOINT']
		?? input.settingOtlpEndpoint
		?? QUIZ_DEFAULT_OTLP_ENDPOINT;
	const otlpEndpoint = quizParseOtlpEndpoint(rawEndpoint, protocol) ?? QUIZ_DEFAULT_OTLP_ENDPOINT;

	// File exporter path
	const fileExporterPath = env['QUIZ_OTEL_FILE_EXPORTER_PATH'] ?? input.settingOutfile;

	// Exporter type
	let exporterType: QuizOTelExporterType;
	if (fileExporterPath) {
		exporterType = 'file';
	} else if (input.settingExporterType) {
		exporterType = input.settingExporterType;
	} else {
		exporterType = protocol === 'grpc' ? 'otlp-grpc' : 'otlp-http';
	}

	// Content capture
	const captureContent = quizEnvBool(env['QUIZ_OTEL_CAPTURE_CONTENT'])
		?? input.settingCaptureContent
		?? false;

	// Max attribute size in characters
	const maxAttributeSizeChars = quizParseMaxAttributeSizeChars(env['QUIZ_OTEL_MAX_ATTRIBUTE_SIZE_CHARS'])
		?? input.settingMaxAttributeSizeChars
		?? 0;

	// Log level
	const validLogLevels = new Set<IQuizOTelConfig['logLevel']>(['trace', 'debug', 'info', 'warn', 'error']);
	const rawLogLevel = env['QUIZ_OTEL_LOG_LEVEL'];
	const logLevel: IQuizOTelConfig['logLevel'] = rawLogLevel && validLogLevels.has(rawLogLevel as IQuizOTelConfig['logLevel'])
		? rawLogLevel as IQuizOTelConfig['logLevel']
		: 'info';

	// HTTP instrumentation
	const httpInstrumentation = quizEnvBool(env['QUIZ_OTEL_HTTP_INSTRUMENTATION']) ?? false;

	// Service name
	const serviceName = env['OTEL_SERVICE_NAME'] ?? QUIZ_OTEL_SERVICE_NAME;

	// Resource attributes
	const resourceAttributes = quizParseResourceAttributes(env['OTEL_RESOURCE_ATTRIBUTES']);

	return Object.freeze({
		enabled: true,
		enabledExplicitly,
		enabledVia,
		exporterType,
		otlpEndpoint,
		otlpProtocol: protocol,
		captureContent,
		maxAttributeSizeChars: maxAttributeSizeChars < 0 ? 0 : maxAttributeSizeChars,
		fileExporterPath,
		dbSpanExporter,
		logLevel,
		httpInstrumentation,
		serviceName,
		serviceVersion: input.extensionVersion,
		sessionId: input.sessionId,
		resourceAttributes,
	});
}

// #endregion

// #region Internal helpers

function createQuizDisabledOTelConfig(input: IQuizOTelConfigInput): IQuizOTelConfig {
	return Object.freeze({
		enabled: false,
		enabledExplicitly: false,
		enabledVia: 'disabled' as const,
		exporterType: 'otlp-http' as const,
		otlpEndpoint: '',
		otlpProtocol: 'http' as const,
		captureContent: false,
		maxAttributeSizeChars: 0,
		dbSpanExporter: false,
		logLevel: 'info' as const,
		httpInstrumentation: false,
		serviceName: QUIZ_OTEL_SERVICE_NAME,
		serviceVersion: input.extensionVersion,
		sessionId: input.sessionId,
		resourceAttributes: {},
	});
}

function quizEnvBool(val: string | undefined): boolean | undefined {
	if (val === undefined) {
		return undefined;
	}
	return val === 'true' || val === '1';
}

function quizParseOtlpEndpoint(raw: string | undefined, protocol: 'grpc' | 'http'): string | undefined {
	if (!raw) {
		return undefined;
	}
	const trimmed = raw.replace(/^["']|["']$/g, '');
	try {
		const url = new URL(trimmed);
		return protocol === 'grpc' ? url.origin : url.href;
	} catch {
		return undefined;
	}
}

function quizParseResourceAttributes(raw: string | undefined): Record<string, string> {
	if (!raw) {
		return {};
	}
	const result: Record<string, string> = {};
	for (const pair of raw.split(',')) {
		const eqIdx = pair.indexOf('=');
		if (eqIdx > 0) {
			const key = pair.substring(0, eqIdx).trim();
			const value = pair.substring(eqIdx + 1).trim();
			if (key) {
				result[key] = value;
			}
		}
	}
	return result;
}

function quizParseMaxAttributeSizeChars(val: string | undefined): number | undefined {
	if (val === undefined || val === '') {
		return undefined;
	}
	const n = Number(val);
	if (!Number.isSafeInteger(n)) {
		return undefined;
	}
	return n;
}

// #endregion
