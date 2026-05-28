/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's ChatWebSocketManager (platform/networking/node/chatWebSocketManager.ts)
//
// Copilot's implementation is in node/ layer (uses undici WebSocket).
// Quiz's browser implementation uses the browser WebSocket API via
// IQuizFetcherService.createWebSocket().

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizFetcherService, IQuizWebSocketConnection } from '../../common/endpoint/quizFetcher.js';
import { IQuizChatWebSocketManager, IQuizChatWebSocketConnection, IQuizChatWebSocketRequestOptions, IQuizChatWebSocketRequestHandle, IQuizCAPIWebSocketErrorEvent, IQuizWebSocketStreamEvent } from '../../common/chat/quizChatWebSocketManager.js';

// #region QuizChatWebSocketManagerImpl (aligned with Copilot's ChatWebSocketManager)

/**
 * Browser-layer implementation of IQuizChatWebSocketManager.
 * Manages persistent WebSocket connections for chat conversations.
 * Aligned with Copilot's ChatWebSocketManager.
 */
export class QuizChatWebSocketManagerImpl extends Disposable implements IQuizChatWebSocketManager {

	declare readonly _serviceBrand: undefined;

	private readonly _connections = new Map<string, QuizChatWebSocketConnectionImpl>();

	constructor(
		@IQuizFetcherService private readonly _fetcherService: IQuizFetcherService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	getOrCreateConnection(conversationId: string, headers: Record<string, string>, initiatingRequestId: string): IQuizChatWebSocketConnection {
		let connection = this._connections.get(conversationId);
		if (!connection || !connection.isOpen) {
			connection = new QuizChatWebSocketConnectionImpl(
				conversationId,
				this._fetcherService,
				this._logService,
				headers,
			);
			this._connections.set(conversationId, connection);
		}
		return connection;
	}

	hasActiveConnection(conversationId: string): boolean {
		const conn = this._connections.get(conversationId);
		return !!conn && conn.isOpen;
	}

	getStatefulMarker(conversationId: string): string | undefined {
		return this._connections.get(conversationId)?.statefulMarker;
	}

	getSummarizedAtRoundId(conversationId: string): string | undefined {
		return undefined; // Not tracked in current implementation
	}

	closeConnection(conversationId: string): void {
		const conn = this._connections.get(conversationId);
		if (conn) {
			conn.dispose();
			this._connections.delete(conversationId);
		}
	}

	closeAll(): void {
		for (const conn of this._connections.values()) {
			conn.dispose();
		}
		this._connections.clear();
	}
}

// #endregion

// #region QuizChatWebSocketConnectionImpl (aligned with Copilot's ChatWebSocketConnection)

class QuizChatWebSocketConnectionImpl extends Disposable implements IQuizChatWebSocketConnection {

	private _wsConnection: IQuizWebSocketConnection | null = null;
	private _isOpen = false;
	private _statefulMarker: string | undefined;
	private _responseHeaders: Record<string, string> = {};
	private _responseStatusCode: number | undefined;
	private _gitHubRequestId = '';

	get isOpen(): boolean { return this._isOpen; }
	get responseHeaders(): Record<string, string> { return this._responseHeaders; }
	get responseStatusCode(): number | undefined { return this._responseStatusCode; }
	get gitHubRequestId(): string { return this._gitHubRequestId; }
	get statefulMarker(): string | undefined { return this._statefulMarker; }

	constructor(
		private readonly _conversationId: string,
		private readonly _fetcherService: IQuizFetcherService,
		private readonly _logService: ILogService,
		private readonly _headers: Record<string, string>,
	) {
		super();
	}

	async connect(): Promise<void> {
		if (!this._fetcherService.createWebSocket) {
			throw new Error('WebSocket not supported by fetcher service');
		}

		const wsUrl = this._buildWebSocketUrl();
		this._logService.debug(`[QuizWS] Connecting to ${wsUrl} for conversation ${this._conversationId}`);

		this._wsConnection = this._fetcherService.createWebSocket(wsUrl, {
			headers: this._headers,
		});

		return new Promise<void>((resolve, reject) => {
			if (!this._wsConnection) {
				reject(new Error('Failed to create WebSocket'));
				return;
			}

			this._wsConnection.onopen = () => {
				this._isOpen = true;
				this._logService.debug(`[QuizWS] Connected for conversation ${this._conversationId}`);
				resolve();
			};

			this._wsConnection.onerror = (ev) => {
				this._logService.error(`[QuizWS] Connection error for ${this._conversationId}: ${ev}`);
				reject(new Error('WebSocket connection failed'));
			};

			this._wsConnection.onclose = (ev) => {
				this._isOpen = false;
				this._logService.debug(`[QuizWS] Connection closed for ${this._conversationId}: code=${ev.code}`);
			};

			// Timeout for connection
			setTimeout(() => {
				if (!this._isOpen) {
					reject(new Error('WebSocket connection timeout'));
				}
			}, 10000);
		});
	}

	sendRequest(
		body: Record<string, unknown>,
		options: IQuizChatWebSocketRequestOptions,
		token: CancellationToken,
	): IQuizChatWebSocketRequestHandle {
		if (!this._wsConnection || !this._isOpen) {
			throw new Error('WebSocket not connected');
		}

		return new QuizChatWebSocketRequestHandleImpl(
			this._wsConnection,
			body,
			options,
			token,
			this._logService,
			(marker) => { this._statefulMarker = marker; },
		);
	}

	private _buildWebSocketUrl(): string {
		// Build a WebSocket URL from the CAPI endpoint
		// In production, this would use the same host as the CAPI endpoint
		// with wss:// protocol and /chat/ws path
		return 'wss://api.githubcopilot.com/chat/ws';
	}

	override dispose(): void {
		if (this._wsConnection) {
			this._wsConnection.close();
			this._wsConnection = null;
		}
		this._isOpen = false;
		super.dispose();
	}
}

// #endregion

// #region QuizChatWebSocketRequestHandleImpl (aligned with Copilot's request handle)

class QuizChatWebSocketRequestHandleImpl implements IQuizChatWebSocketRequestHandle {
	private readonly _onEventEmitter = new Emitter<IQuizWebSocketStreamEvent>();
	private readonly _onCAPIErrorEmitter = new Emitter<IQuizCAPIWebSocketErrorEvent>();
	private readonly _onErrorEmitter = new Emitter<Error>();
	private _resolveDone: (() => void) | null = null;
	private _resolveFirstEvent: ((value: IQuizWebSocketStreamEvent | IQuizCAPIWebSocketErrorEvent) => void) | null = null;
	private _firstEventFired = false;

	readonly onEvent: Event<IQuizWebSocketStreamEvent> = this._onEventEmitter.event;
	readonly onCAPIError: Event<IQuizCAPIWebSocketErrorEvent> = this._onCAPIErrorEmitter.event;
	readonly onError: Event<Error> = this._onErrorEmitter.event;
	readonly firstEvent: Promise<IQuizWebSocketStreamEvent | IQuizCAPIWebSocketErrorEvent>;
	readonly done: Promise<void>;

	constructor(
		private readonly _wsConnection: IQuizWebSocketConnection,
		body: Record<string, unknown>,
		options: IQuizChatWebSocketRequestOptions,
		token: CancellationToken,
		logService: ILogService,
		onStatefulMarker: (marker: string) => void,
	) {
		this.firstEvent = new Promise<IQuizWebSocketStreamEvent | IQuizCAPIWebSocketErrorEvent>((resolve) => {
			this._resolveFirstEvent = resolve;
		});
		this.done = new Promise<void>((resolve) => {
			this._resolveDone = resolve;
		});

		// Send the request
		const requestPayload = JSON.stringify({
			type: 'response.create',
			response: body,
			...options,
		});
		this._wsConnection.send(requestPayload);

		// Listen for responses
		this._wsConnection.onmessage = (ev) => {
			if (token.isCancellationRequested) {
				return;
			}

			const data = typeof ev.data === 'string' ? ev.data : '';
			try {
				const parsed = JSON.parse(data) as Record<string, unknown>;
				const eventType = parsed.type as string;

				// Check for CAPI error
				if (eventType === 'error' && parsed.error && typeof (parsed.error as Record<string, unknown>).code === 'string') {
					const capiError: IQuizCAPIWebSocketErrorEvent = {
						type: 'error',
						error: parsed.error as { code: string; message: string },
					};
					this._onCAPIErrorEmitter.fire(capiError);
					if (!this._firstEventFired) {
						this._firstEventFired = true;
						this._resolveFirstEvent?.(capiError);
					}
					return;
				}

				// Normal stream event
				const streamEvent: IQuizWebSocketStreamEvent = { type: eventType, ...parsed };
				this._onEventEmitter.fire(streamEvent);

				if (!this._firstEventFired) {
					this._firstEventFired = true;
					this._resolveFirstEvent?.(streamEvent);
				}

				// Track stateful marker
				if (eventType === 'response.completed' || eventType === 'response.done') {
					const response = parsed.response as Record<string, unknown> | undefined;
					if (response?.id) {
						onStatefulMarker(response.id as string);
					}
				}
			} catch {
				logService.warn(`[QuizWS] Failed to parse WebSocket message: ${data.substring(0, 100)}`);
			}
		};

		// Handle token cancellation
		token.onCancellationRequested(() => {
			logService.debug('[QuizWS] Request cancelled, closing WebSocket request');
			this._resolveDone?.();
		});
	}
}

// #endregion
