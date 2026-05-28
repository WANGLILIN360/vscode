/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region IQuizFetcherService (aligned with Copilot's IFetcherService)

export const IQuizFetcherService = createDecorator<IQuizFetcherService>('quizFetcherService');

/**
 * HTTP fetch abstraction for Quiz's API requests.
 * Aligned with Copilot's IFetcherService (from platform/networking/common/fetcherService.ts).
 *
 * This is the **pure HTTP path** — it sends requests to a URL directly,
 * without any CAPI SDK routing. Used for:
 * - BYOK endpoints (string URL)
 * - xtab completions (string URL)
 * - WebSocket connections
 * - Any request where the endpoint provides a raw URL
 *
 * For CAPI SDK requests (RequestMetadata), use IQuizQAPIClientService instead.
 * The routing between the two is handled by IQuizNetworkService.networkRequest().
 */
export interface IQuizFetcherService {
	readonly _serviceBrand: undefined;

	/** Event fired when a fetch starts. Aligned with Copilot's IFetcherService.onDidFetch. */
	readonly onDidFetch: Event<IQuizFetchEvent>;
	/** Event fired when a fetch completes. Aligned with Copilot's IFetcherService.onDidCompleteFetch. */
	readonly onDidCompleteFetch: Event<IQuizFetchTelemetryEvent>;

	/**
	 * Fetch a URL with the given options.
	 * Aligned with Copilot's IFetcherService.fetch().
	 */
	fetch(url: string, options: IQuizFetchOptions): Promise<unknown>;

	/**
	 * Fetch a URL and return the response as a streaming SSE response.
	 * Aligned with Copilot's IFetcherService.fetch() when used with stream=true
	 * and the response is consumed as an AsyncIterable of bytes.
	 *
	 * Returns the raw response with status, headers, and an async iterable body
	 * for SSE parsing. Used by networkRequestStream for chat completions streaming.
	 */
	fetchStream(url: string, options: IQuizFetchOptions): Promise<IQuizFetcherStreamResponse>;

	/**
	 * Create a WebSocket connection to the given URL.
	 * Aligned with Copilot's IFetcherService.createWebSocket().
	 */
	createWebSocket?(url: string, options?: IQuizWebSocketOptions): IQuizWebSocketConnection;

	/**
	 * Disconnect all active connections and clear connection pools.
	 * Aligned with Copilot's IFetcherService.disconnectAll().
	 * Called before retrying a failed request to ensure clean state.
	 */
	disconnectAll(): Promise<unknown>;

	/**
	 * Create an abort controller for request cancellation.
	 * Aligned with Copilot's IFetcherService.makeAbortController().
	 */
	makeAbortController(): IQuizAbortController;

	/**
	 * Check if an error was caused by request abortion.
	 * Aligned with Copilot's IFetcherService.isAbortError().
	 */
	isAbortError(e: unknown): boolean;

	/**
	 * Check if an error indicates internet disconnection.
	 * Aligned with Copilot's IFetcherService.isInternetDisconnectedError().
	 */
	isInternetDisconnectedError(e: unknown): boolean;

	/**
	 * Check if an error originated from the fetcher itself.
	 * Aligned with Copilot's IFetcherService.isFetcherError().
	 */
	isFetcherError(e: unknown): boolean;

	/**
	 * Check if an error indicates the network process crashed (Electron).
	 * Aligned with Copilot's IFetcherService.isNetworkProcessCrashedError().
	 */
	isNetworkProcessCrashedError(e: unknown): boolean;

	/**
	 * Get a user-friendly error message for a fetcher error.
	 * Aligned with Copilot's IFetcherService.getUserMessageForFetcherError().
	 */
	getUserMessageForFetcherError(err: unknown): string;

	/**
	 * Fetch with pagination support.
	 * Aligned with Copilot's IFetcherService.fetchWithPagination().
	 */
	fetchWithPagination<T>(baseUrl: string, options: IQuizPaginationOptions<T>): Promise<T[]>;

	/**
	 * Get the user agent library string for request headers.
	 * Aligned with Copilot's IFetcherService.getUserAgentLibrary().
	 */
	getUserAgentLibrary(): string;
}

// #endregion

// #region IQuizFetchOptions (aligned with Copilot's FetchOptions)

/**
 * Options for an HTTP fetch request.
 * Aligned with Copilot's FetchOptions (from @vscode/copilot-api).
 */
export interface IQuizFetchOptions {
	/** Call site identifier for telemetry */
	callSite: string;
	/** HTTP headers */
	headers?: { [name: string]: string };
	/** Request body */
	body?: BodyInit;
	/** Request timeout in ms */
	timeout?: number;
	/** JSON body (convenience, sets Content-Type automatically) */
	json?: unknown;
	/** HTTP method */
	method?: 'GET' | 'POST' | 'PUT';
	/** Abort signal for cancellation */
	signal?: IQuizAbortSignal;
	/** Whether to suppress integration ID header */
	suppressIntegrationId?: boolean;
	/** Whether to use a specific fetcher implementation */
	useFetcher?: string;
}

// #endregion

// #region IQuizFetchEvent / IQuizFetchTelemetryEvent (aligned with Copilot's FetchEvent)

export interface IQuizFetchEvent {
	readonly url: string;
	readonly callSite: string;
	readonly method: string;
}

export interface IQuizFetchTelemetryEvent {
	readonly url: string;
	readonly callSite: string;
	readonly method: string;
	readonly status: number;
	readonly duration: number;
	readonly error?: unknown;
}

// #endregion

// #region IQuizPaginationOptions (aligned with Copilot's PaginationOptions)

export interface IQuizPaginationOptions<T> {
	callSite: string;
	headers?: { [name: string]: string };
	readonly getNextPageUrl: (response: T) => string | undefined;
}

// #endregion

// #region IQuizWebSocketOptions / IQuizWebSocketConnection (aligned with Copilot's WebSocket support)

export interface IQuizWebSocketOptions {
	readonly headers?: { readonly [name: string]: string };
	readonly protocols?: string[];
}

export interface IQuizWebSocketConnection {
	send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
	close(code?: number, reason?: string): void;
	onmessage: ((ev: IQuizWebSocketMessageEvent) => void) | null;
	onerror: ((ev: IQuizWebSocketErrorEvent) => void) | null;
	onclose: ((ev: IQuizWebSocketCloseEvent) => void) | null;
	onopen: ((ev: IQuizWebSocketEvent) => void) | null;
	readonly readyState: IQuizWebSocketReadyState;
}

export const enum IQuizWebSocketReadyState {
	CONNECTING = 0,
	OPEN = 1,
	CLOSING = 2,
	CLOSED = 3,
}

export interface IQuizWebSocketEvent {
	readonly type: string;
}
export interface IQuizWebSocketMessageEvent extends IQuizWebSocketEvent {
	readonly data: string | ArrayBufferLike | Blob | ArrayBufferView;
}
export interface IQuizWebSocketErrorEvent extends IQuizWebSocketEvent {
	readonly error?: unknown;
}
export interface IQuizWebSocketCloseEvent extends IQuizWebSocketEvent {
	readonly code: number;
	readonly reason: string;
	readonly wasClean: boolean;
}

// #endregion

// #region IQuizAbortSignal / IQuizAbortController (aligned with Copilot's IAbortSignal / IAbortController)

export interface IQuizAbortSignal {
	readonly aborted: boolean;
	addEventListener(type: 'abort', listener: (this: AbortSignal) => void): void;
	removeEventListener(type: 'abort', listener: (this: AbortSignal) => void): void;
}

export interface IQuizAbortController {
	readonly signal: IQuizAbortSignal;
	abort(): void;
}

// #endregion

// #region IQuizFetcherResponse

export interface IQuizFetcherResponse {
	readonly status: number;
	readonly headers: { readonly [name: string]: string };
	readonly body: unknown;
}

// #endregion

// #region IQuizFetcherStreamResponse (aligned with Copilot's streaming fetch response)

/**
 * Streaming fetch response with status, headers, and an async iterable body.
 * Aligned with Copilot's streaming fetch pattern where the response body
 * is consumed as an AsyncIterable of Uint8Array chunks for SSE parsing.
 */
export interface IQuizFetcherStreamResponse {
	readonly status: number;
	readonly headers: { readonly [name: string]: string };
	/** Stream of response body chunks (bytes or text) for SSE parsing */
	readonly stream: AsyncIterable<Uint8Array | string>;
	/** The request ID from response headers (X-GitHub-Request-Id, X-RequestId, etc.) */
	readonly headerRequestId: string;
}

// #endregion

// #region NO_FETCH_TELEMETRY (aligned with Copilot's NO_FETCH_TELEMETRY)

/**
 * Call site value that suppresses fetch telemetry.
 * Aligned with Copilot's NO_FETCH_TELEMETRY constant.
 * Used for high-volume requests (chat completions, telemetry) where
 * per-request telemetry is not needed.
 */
export const NO_FETCH_TELEMETRY = 'NO_FETCH_TELEMETRY';

// #endregion

// #region Null implementation

export class NullQuizFetcherService implements IQuizFetcherService {
	declare readonly _serviceBrand: undefined;
	readonly onDidFetch: Event<IQuizFetchEvent> = Event.None;
	readonly onDidCompleteFetch: Event<IQuizFetchTelemetryEvent> = Event.None;

	async fetch(_url: string, _options: IQuizFetchOptions): Promise<unknown> { return {}; }
	async fetchStream(_url: string, _options: IQuizFetchOptions): Promise<IQuizFetcherStreamResponse> {
		return { status: 200, headers: {}, stream: (async function* () { })(), headerRequestId: '' };
	}
	createWebSocket(_url: string, _options?: IQuizWebSocketOptions): IQuizWebSocketConnection { return new NullQuizWebSocketConnection(); }
	async disconnectAll(): Promise<unknown> { return undefined; }
	makeAbortController(): IQuizAbortController { return new NullQuizAbortController(); }
	isAbortError(): boolean { return false; }
	isInternetDisconnectedError(): boolean { return false; }
	isFetcherError(): boolean { return false; }
	isNetworkProcessCrashedError(): boolean { return false; }
	getUserMessageForFetcherError(): string { return 'Unknown error'; }
	async fetchWithPagination<T>(): Promise<T[]> { return []; }
	getUserAgentLibrary(): string { return 'quiz-null-fetcher'; }
}

class NullQuizWebSocketConnection implements IQuizWebSocketConnection {
	onmessage: ((ev: IQuizWebSocketMessageEvent) => void) | null = null;
	onerror: ((ev: IQuizWebSocketErrorEvent) => void) | null = null;
	onclose: ((ev: IQuizWebSocketCloseEvent) => void) | null = null;
	onopen: ((ev: IQuizWebSocketEvent) => void) | null = null;
	get readyState(): IQuizWebSocketReadyState { return IQuizWebSocketReadyState.CLOSED; }
	send(): void { }
	close(): void { }
}

class NullQuizAbortController implements IQuizAbortController {
	private _aborted = false;
	get signal(): IQuizAbortSignal {
		const controller = this;
		return {
			get aborted() { return controller._aborted; },
			addEventListener() { },
			removeEventListener() { },
		};
	}
	abort(): void { this._aborted = true; }
}

// #endregion
