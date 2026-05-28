/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's platform/networking/node/chatWebSocketManager.ts
//
// Copilot's WebSocket manager is in node/ layer because it uses Node.js WebSocket
// (undici). Quiz places the interface in common/ and the browser implementation
// uses the browser WebSocket API.

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region IQuizChatWebSocketManager (aligned with Copilot's IChatWebSocketManager)

export const IQuizChatWebSocketManager = createDecorator<IQuizChatWebSocketManager>('quizChatWebSocketManager');

/**
 * Manages persistent WebSocket connections for chat conversations.
 * Aligned with Copilot's IChatWebSocketManager (platform/networking/node/chatWebSocketManager.ts).
 *
 * The WebSocket connection is shared across turns and tool call rounds within
 * the same conversation, keeping server-side context alive. This enables
 * the Responses API's stateful marker feature to avoid re-sending full
 * message history on subsequent requests.
 */
export interface IQuizChatWebSocketManager {
	readonly _serviceBrand: undefined;

	/**
	 * Gets or creates a WebSocket connection for the given conversation.
	 * Aligned with Copilot's IChatWebSocketManager.getOrCreateConnection().
	 */
	getOrCreateConnection(conversationId: string, headers: Record<string, string>, initiatingRequestId: string): IQuizChatWebSocketConnection;

	/**
	 * Returns true if there is an open WebSocket connection for the given conversation.
	 * Aligned with Copilot's IChatWebSocketManager.hasActiveConnection().
	 */
	hasActiveConnection(conversationId: string): boolean;

	/**
	 * Returns the stateful marker (last completed response ID) for the given
	 * conversation's active WebSocket connection.
	 * Aligned with Copilot's IChatWebSocketManager.getStatefulMarker().
	 */
	getStatefulMarker(conversationId: string): string | undefined;

	/**
	 * Returns the round ID at which the last client-side summarization occurred.
	 * Aligned with Copilot's IChatWebSocketManager.getSummarizedAtRoundId().
	 */
	getSummarizedAtRoundId(conversationId: string): string | undefined;

	/**
	 * Closes and removes the connection for a specific conversation.
	 * Aligned with Copilot's IChatWebSocketManager.closeConnection().
	 */
	closeConnection(conversationId: string): void;

	/**
	 * Closes all active connections.
	 * Aligned with Copilot's IChatWebSocketManager.closeAll().
	 */
	closeAll(): void;
}

// #endregion

// #region IQuizChatWebSocketConnection (aligned with Copilot's IChatWebSocketConnection)

/**
 * A persistent WebSocket connection for a single conversation.
 * Aligned with Copilot's IChatWebSocketConnection.
 */
export interface IQuizChatWebSocketConnection extends IDisposable {
	/** Opens the WebSocket connection. Must be called before sendRequest. */
	connect(): Promise<void>;

	/** Sends a response.create request and returns a request handle. */
	sendRequest(
		body: Record<string, unknown>,
		options: IQuizChatWebSocketRequestOptions,
		token: CancellationToken,
	): IQuizChatWebSocketRequestHandle;

	/** Whether the connection is currently open and usable. */
	readonly isOpen: boolean;

	/** Response headers from the WebSocket connection handshake. */
	readonly responseHeaders: Record<string, string>;

	/** Response status code from the WebSocket connection handshake. */
	readonly responseStatusCode: number | undefined;

	/** The GitHub request ID from response headers. */
	readonly gitHubRequestId: string;

	/**
	 * The response.id from the last completed response on this connection.
	 * Used as `previous_response_id` on subsequent requests.
	 * Aligned with Copilot's IChatWebSocketConnection.statefulMarker.
	 */
	readonly statefulMarker: string | undefined;
}

// #endregion

// #region IQuizChatWebSocketRequestOptions (aligned with Copilot's IChatWebSocketRequestOptions)

/**
 * Options for a WebSocket chat request.
 * Aligned with Copilot's IChatWebSocketRequestOptions.
 */
export interface IQuizChatWebSocketRequestOptions {
	userInitiated: boolean;
	turnId: string;
	requestId: string;
	model: string;
	countTokens: () => Promise<number>;
	tokenCountMax: number;
	modelMaxPromptTokens: number;
	summarizedAtRoundId?: string;
	modeChanged?: boolean;
}

// #endregion

// #region IQuizChatWebSocketRequestHandle (aligned with Copilot's IChatWebSocketRequestHandle)

/**
 * Handle for an in-flight WebSocket request.
 * Aligned with Copilot's IChatWebSocketRequestHandle.
 */
export interface IQuizChatWebSocketRequestHandle {
	/** Fires for each stream event received from the server. */
	readonly onEvent: Event<IQuizWebSocketStreamEvent>;
	/** Fires when a CAPI WebSocket error is received. */
	readonly onCAPIError: Event<IQuizCAPIWebSocketErrorEvent>;
	/** Fires when a transport-level error occurs. */
	readonly onError: Event<Error>;
	/** Resolves with the first event from the server. */
	readonly firstEvent: Promise<IQuizWebSocketStreamEvent | IQuizCAPIWebSocketErrorEvent>;
	/** Resolves when the request has finished. */
	readonly done: Promise<void>;
}

// #endregion

// #region IQuizCAPIWebSocketErrorEvent (aligned with Copilot's CAPIWebSocketErrorEvent)

/**
 * CAPI WebSocket error shape.
 * Aligned with Copilot's CAPIWebSocketErrorEvent.
 */
export interface IQuizCAPIWebSocketErrorEvent {
	readonly type: 'error';
	readonly error: {
		readonly code: string;
		readonly message: string;
	};
}

/**
 * Check if a WebSocket event is a CAPI error.
 * Aligned with Copilot's isCAPIWebSocketError().
 */
export function isQuizCAPIWebSocketError(event: IQuizWebSocketStreamEvent | IQuizCAPIWebSocketErrorEvent): event is IQuizCAPIWebSocketErrorEvent {
	return event.type === 'error' && 'error' in event && typeof (event as IQuizCAPIWebSocketErrorEvent).error?.code === 'string';
}

// #endregion

// #region IQuizWebSocketStreamEvent (simplified stream event type)

/**
 * A stream event from the WebSocket connection.
 * Simplified representation of OpenAI Responses API stream events.
 */
export interface IQuizWebSocketStreamEvent {
	readonly type: string;
	readonly [key: string]: unknown;
}

// #endregion

// #region NullQuizChatWebSocketManager (aligned with Copilot's NullChatWebSocketManager)

/**
 * No-op implementation for contexts where WebSocket is not available.
 * Aligned with Copilot's NullChatWebSocketManager.
 */
export class NullQuizChatWebSocketManager implements IQuizChatWebSocketManager {
	declare readonly _serviceBrand: undefined;

	getOrCreateConnection(_conversationId: string, _headers?: Record<string, string>, _initiatingRequestId?: string): IQuizChatWebSocketConnection {
		throw new Error('WebSocket not available');
	}
	hasActiveConnection(_conversationId: string): boolean { return false; }
	getStatefulMarker(_conversationId: string): string | undefined { return undefined; }
	getSummarizedAtRoundId(_conversationId: string): string | undefined { return undefined; }
	closeConnection(_conversationId: string): void { }
	closeAll(): void { }
}

// #endregion
