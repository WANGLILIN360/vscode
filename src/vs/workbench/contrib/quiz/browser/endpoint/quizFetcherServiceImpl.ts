/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRequestService, asText, asJson } from '../../../../../platform/request/common/request.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IQuizFetcherService, IQuizFetchOptions, IQuizWebSocketOptions, IQuizWebSocketConnection, IQuizWebSocketReadyState, IQuizWebSocketMessageEvent, IQuizWebSocketErrorEvent, IQuizWebSocketCloseEvent, IQuizWebSocketEvent, IQuizAbortController, IQuizAbortSignal, IQuizFetchEvent, IQuizFetchTelemetryEvent, IQuizPaginationOptions, IQuizFetcherStreamResponse, NO_FETCH_TELEMETRY } from '../../common/endpoint/quizFetcher.js';

// #region QuizFetcherServiceImpl (aligned with Copilot's IFetcherService implementations)

/**
 * Browser-layer implementation of IQuizFetcherService.
 * Bridges VS Code's IRequestService for HTTP requests.
 * Aligned with Copilot's ElectronFetcher / NodeFetchFetcher / NodeFetcher stack.
 */
export class QuizFetcherServiceImpl extends Disposable implements IQuizFetcherService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidFetch = this._register(new Emitter<IQuizFetchEvent>());
	readonly onDidFetch: Event<IQuizFetchEvent> = this._onDidFetch.event;

	private readonly _onDidCompleteFetch = this._register(new Emitter<IQuizFetchTelemetryEvent>());
	readonly onDidCompleteFetch: Event<IQuizFetchTelemetryEvent> = this._onDidCompleteFetch.event;

	constructor(
		@IRequestService private readonly _requestService: IRequestService,
		@IEnvironmentService private readonly _environmentService: IEnvironmentService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	async fetch(url: string, options: IQuizFetchOptions): Promise<unknown> {
		const startTime = Date.now();
		if (options.callSite !== NO_FETCH_TELEMETRY) {
			this._onDidFetch.fire({ url, callSite: options.callSite, method: options.method ?? 'GET' });
		}

		try {
			const response = await this._requestService.request({
				type: options.method ?? 'POST',
				url,
				headers: options.headers as Record<string, string> | undefined,
				data: options.json ? JSON.stringify(options.json) : options.body?.toString(),
				timeout: options.timeout,
				callSite: options.callSite,
			}, CancellationToken.None);

			const status = response.res.statusCode ?? 200;
			const json = await asJson(response);
			const result = json !== null ? json : (await asText(response)) ?? '';

			if (options.callSite !== NO_FETCH_TELEMETRY) {
				this._onDidCompleteFetch.fire({ url, callSite: options.callSite, method: options.method ?? 'GET', status, duration: Date.now() - startTime });
			}
			return result;
		} catch (err) {
			if (options.callSite !== NO_FETCH_TELEMETRY) {
				this._onDidCompleteFetch.fire({ url, callSite: options.callSite, method: options.method ?? 'GET', status: 0, duration: Date.now() - startTime, error: err });
			}
			this._logService.error(`[QuizFetcher] Fetch failed for ${url}: ${err}`);
			throw err;
		}
	}

	async fetchStream(url: string, options: IQuizFetchOptions): Promise<IQuizFetcherStreamResponse> {
		const startTime = Date.now();
		if (options.callSite !== NO_FETCH_TELEMETRY) {
			this._onDidFetch.fire({ url, callSite: options.callSite, method: options.method ?? 'GET' });
		}

		try {
			const response = await this._requestService.request({
				type: options.method ?? 'POST',
				url,
				headers: options.headers as Record<string, string> | undefined,
				data: options.json ? JSON.stringify(options.json) : options.body?.toString(),
				timeout: options.timeout,
				callSite: options.callSite,
			}, CancellationToken.None);

			const status = response.res.statusCode ?? 200;
			const headers: Record<string, string> = {};
			// response.res.headers may be a plain object (Record) or Headers instance
			const rawHeaders = response.res.headers;
			if (rawHeaders && typeof rawHeaders === 'object') {
				if (_isIterableHeaders(rawHeaders)) {
					for (const [key, value] of rawHeaders) {
						headers[String(key).toLowerCase()] = String(value);
					}
				} else {
					for (const [key, value] of Object.entries(rawHeaders)) {
						if (typeof value === 'string') {
							headers[key.toLowerCase()] = value;
						} else if (Array.isArray(value)) {
							headers[key.toLowerCase()] = value.join(', ');
						} else if (value !== undefined && value !== null) {
							headers[key.toLowerCase()] = String(value);
						}
					}
				}
			}

			const headerRequestId = headers['x-github-request-id'] ?? headers['x-requestid'] ?? '';

			// Convert the response stream into an AsyncIterable<Uint8Array | string>
			// IRequestService returns a readable stream in response.stream
			const stream: AsyncIterable<Uint8Array | string> = response.stream
				? _readableStreamToAsyncIterable(response.stream)
				: (async function* () {
					// Fallback: read the full body and yield as a single chunk
					const text = await asText(response);
					if (text) { yield text; }
				})();

			if (options.callSite !== NO_FETCH_TELEMETRY) {
				this._onDidCompleteFetch.fire({ url, callSite: options.callSite, method: options.method ?? 'GET', status, duration: Date.now() - startTime });
			}

			return { status, headers, stream, headerRequestId };
		} catch (err) {
			if (options.callSite !== NO_FETCH_TELEMETRY) {
				this._onDidCompleteFetch.fire({ url, callSite: options.callSite, method: options.method ?? 'GET', status: 0, duration: Date.now() - startTime, error: err });
			}
			this._logService.error(`[QuizFetcher] fetchStream failed for ${url}: ${err}`);
			throw err;
		}
	}

	createWebSocket(url: string, options?: IQuizWebSocketOptions): IQuizWebSocketConnection {
		this._logService.debug(`[QuizFetcher] Creating WebSocket connection to ${url}`);
		return new BrowserQuizWebSocketConnection(url, options);
	}

	async disconnectAll(): Promise<unknown> {
		// IRequestService doesn't have a disconnectAll method;
		// this is a no-op in the browser layer, but the interface
		// is preserved for compatibility with Copilot's retry logic.
		this._logService.debug('[QuizFetcher] disconnectAll called (no-op in browser)');
		return undefined;
	}

	makeAbortController(): IQuizAbortController {
		return new QuizAbortControllerImpl();
	}

	isAbortError(e: unknown): boolean {
		return e instanceof CancellationError || (e instanceof Error && e.name === 'AbortError') || (e instanceof DOMException && e.name === 'AbortError');
	}

	isInternetDisconnectedError(e: unknown): boolean {
		if (!(e instanceof Error)) { return false; }
		const msg = e.message.toLowerCase();
		return msg.includes('enetdown') || msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('network') || msg.includes('offline') || msg.includes('err_internet_disconnected') || msg.includes('err_name_not_resolved');
	}

	isFetcherError(e: unknown): boolean {
		return e instanceof Error && !this.isAbortError(e);
	}

	isNetworkProcessCrashedError(_e: unknown): boolean {
		// Network process crash is an Electron-specific error;
		// not applicable in browser layer.
		return false;
	}

	getUserMessageForFetcherError(err: unknown): string {
		if (this.isInternetDisconnectedError(err)) {
			return 'Internet connection lost. Please check your network and try again.';
		}
		if (this.isAbortError(err)) {
			return 'Request was cancelled.';
		}
		if (err instanceof Error) {
			return err.message;
		}
		return String(err);
	}

	async fetchWithPagination<T>(baseUrl: string, options: IQuizPaginationOptions<T>): Promise<T[]> {
		const results: T[] = [];
		let currentUrl: string | undefined = baseUrl;

		while (currentUrl) {
			const response = await this.fetch(currentUrl, {
				callSite: options.callSite,
				headers: options.headers,
			}) as T;
			results.push(response);
			currentUrl = options.getNextPageUrl(response);
		}

		return results;
	}

	getUserAgentLibrary(): string {
		const version = this._environmentService.isBuilt ? '1.0.0' : '0.0.0';
		return `VSCode/${version} (quiz)`;
	}
}

// #endregion

// #region QuizAbortControllerImpl

class QuizAbortControllerImpl implements IQuizAbortController {
	private readonly _controller = new AbortController();
	get signal(): IQuizAbortSignal {
		return this._controller.signal as unknown as IQuizAbortSignal;
	}
	abort(): void {
		this._controller.abort();
	}
}

// #endregion

// #region BrowserQuizWebSocketConnection (browser-layer WebSocket)

class BrowserQuizWebSocketConnection implements IQuizWebSocketConnection {

	private readonly _socket: WebSocket;

	onmessage: ((ev: IQuizWebSocketMessageEvent) => void) | null = null;
	onerror: ((ev: IQuizWebSocketErrorEvent) => void) | null = null;
	onclose: ((ev: IQuizWebSocketCloseEvent) => void) | null = null;
	onopen: ((ev: IQuizWebSocketEvent) => void) | null = null;

	constructor(url: string, options?: IQuizWebSocketOptions) {
		this._socket = new WebSocket(url, options?.protocols);

		this._socket.onopen = () => { this.onopen?.({ type: 'open' }); };
		this._socket.onmessage = (ev: MessageEvent) => { this.onmessage?.({ type: 'message', data: ev.data }); };
		this._socket.onerror = (ev: globalThis.Event) => { this.onerror?.({ type: 'error', error: ev }); };
		this._socket.onclose = (ev: CloseEvent) => { this.onclose?.({ type: 'close', code: ev.code, reason: ev.reason, wasClean: ev.wasClean }); };
	}

	get readyState(): IQuizWebSocketReadyState {
		switch (this._socket.readyState) {
			case WebSocket.CONNECTING: return IQuizWebSocketReadyState.CONNECTING;
			case WebSocket.OPEN: return IQuizWebSocketReadyState.OPEN;
			case WebSocket.CLOSING: return IQuizWebSocketReadyState.CLOSING;
			case WebSocket.CLOSED: return IQuizWebSocketReadyState.CLOSED;
			default: return IQuizWebSocketReadyState.CLOSED;
		}
	}

	send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void { this._socket.send(data as any); }
	close(code?: number, reason?: string): void { this._socket.close(code, reason); }
}

// #endregion

// #region Helper: _readableStreamToAsyncIterable

/**
 * Convert a Node.js Readable or browser ReadableStream to an AsyncIterable<Uint8Array | string>.
 * Used by fetchStream to provide SSE-compatible streaming.
 */
async function* _readableStreamToAsyncIterable(stream: unknown): AsyncIterable<Uint8Array | string> {
	if (_isNodeReadableStream(stream)) {
		// Node-style readable stream
		const chunks: (Uint8Array | string)[] = [];
		let done = false;
		let resolveNext: (() => void) | null = null;

		stream.on('data', (chunk: unknown) => {
			if (chunk instanceof Uint8Array) {
				chunks.push(chunk);
			} else if (typeof chunk === 'string') {
				chunks.push(chunk);
			} else if (_isBufferLike(chunk)) {
				chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset ?? 0, chunk.byteLength ?? chunk.buffer.byteLength));
			} else {
				chunks.push(String(chunk));
			}
			resolveNext?.();
		});
		stream.on('end', () => { done = true; resolveNext?.(); });
		stream.on('error', () => { done = true; resolveNext?.(); });

		while (!done || chunks.length > 0) {
			if (chunks.length > 0) {
				yield chunks.shift()!;
			} else {
				await new Promise<void>(r => { resolveNext = r; });
				resolveNext = null;
			}
		}
	} else if (_isBrowserReadableStream(stream)) {
		// Browser ReadableStream
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) { break; }
				if (value instanceof Uint8Array) {
					yield value;
				} else {
					yield decoder.decode(value, { stream: true });
				}
			}
		} finally {
			reader.releaseLock();
		}
	} else {
		// Unknown stream type — try async iteration
		for await (const chunk of stream as AsyncIterable<unknown>) {
			if (chunk instanceof Uint8Array) {
				yield chunk;
			} else if (typeof chunk === 'string') {
				yield chunk;
			} else if (_isBufferLike(chunk)) {
				yield new Uint8Array(chunk.buffer, chunk.byteOffset ?? 0, chunk.byteLength ?? chunk.buffer.byteLength);
			} else {
				yield String(chunk);
			}
		}
	}
}

// #region Type guards

/** Check if value is an iterable Headers instance */
function _isIterableHeaders(value: unknown): value is Iterable<[string, string]> {
	return value !== null && typeof value === 'object' && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function';
}

/** Check if value is a Node.js ReadableStream */
function _isNodeReadableStream(value: unknown): value is NodeJS.ReadableStream {
	return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>).on === 'function';
}

/** Check if value is a browser ReadableStream */
function _isBrowserReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
	return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>).getReader === 'function';
}

/** Buffer-like object with typed array properties (e.g. VSBuffer) */
interface IBufferLike {
	readonly buffer: ArrayBufferLike;
	readonly byteOffset?: number;
	readonly byteLength?: number;
}

/** Check if value is a buffer-like object */
function _isBufferLike(value: unknown): value is IBufferLike {
	return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>).buffer === 'object';
}

// #endregion

// #endregion
