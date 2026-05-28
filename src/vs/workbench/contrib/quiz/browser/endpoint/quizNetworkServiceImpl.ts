/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationError } from '../../../../../base/common/errors.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuizNetworkService, IQuizNetworkRequestEndpoint, IQuizNetworkRequest, IQuizNetworkResponse, IQuizNetworkStreamChunk, IQuizWebSocketStreamConnection, quizNetworkRequest, quizNetworkRequestStream } from '../../common/endpoint/quizNetwork.js';
import { IQuizFetcherService } from '../../common/endpoint/quizFetcher.js';
import { IQuizQAPIClientService } from '../../common/endpoint/quizQAPIClient.js';

// #region QuizNetworkServiceImpl (aligned with Copilot's networkRequest routing)

/**
 * Browser-layer implementation of IQuizNetworkService.
 * Routes requests between the HTTP path (IQuizFetcherService) and
 * the CAPI SDK path (IQuizQAPIClientService).
 *
 * Aligned with Copilot's networkRequest() function from
 * platform/networking/common/networking.ts.
 */
export class QuizNetworkServiceImpl extends Disposable implements IQuizNetworkService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IQuizFetcherService private readonly _fetcherService: IQuizFetcherService,
		@IQuizQAPIClientService private readonly _qapiClientService: IQuizQAPIClientService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	async networkRequest(endpoint: IQuizNetworkRequestEndpoint, request: IQuizNetworkRequest): Promise<IQuizNetworkResponse> {
		const routingPath = typeof endpoint.urlOrRequestMetadata === 'string' ? 'HTTP' : 'CAPI';
		this._logService.debug(`[QuizNetwork] Routing request via ${routingPath} path (callSite: ${request.callSite ?? 'unknown'})`);

		try {
			return await quizNetworkRequest(this._fetcherService, this._qapiClientService, endpoint, request);
		} catch (err) {
			if (err instanceof Error && err.message === 'Cancelled') {
				this._logService.debug(`[QuizNetwork] Request cancelled via ${routingPath} path`);
				throw new CancellationError();
			}
			this._logService.error(`[QuizNetwork] Request failed via ${routingPath} path: ${err}`);
			throw err;
		}
	}

	async *networkRequestStream(endpoint: IQuizNetworkRequestEndpoint, request: IQuizNetworkRequest): AsyncIterable<IQuizNetworkStreamChunk> {
		const routingPath = typeof endpoint.urlOrRequestMetadata === 'string' ? 'HTTP' : 'CAPI';
		this._logService.debug(`[QuizNetwork] Starting stream request via ${routingPath} path`);

		try {
			yield* quizNetworkRequestStream(this._fetcherService, this._qapiClientService, endpoint, request);
		} catch (err) {
			if (err instanceof Error && err.message === 'Cancelled') {
				this._logService.debug(`[QuizNetwork] Stream request cancelled via ${routingPath} path`);
				throw new CancellationError();
			}
			this._logService.error(`[QuizNetwork] Stream request failed via ${routingPath} path: ${err}`);
			throw err;
		}
	}

	async createWebSocketConnection(endpoint: IQuizNetworkRequestEndpoint, request: IQuizNetworkRequest): Promise<IQuizWebSocketStreamConnection> {
		if (typeof endpoint.urlOrRequestMetadata !== 'string') {
			throw new Error('[QuizNetwork] WebSocket connections require a string URL endpoint, not QuizRequestMetadata');
		}

		if (!this._fetcherService.createWebSocket) {
			throw new Error('[QuizNetwork] WebSocket connections are not supported by the current fetcher service');
		}

		this._logService.debug(`[QuizNetwork] Creating WebSocket connection to ${endpoint.urlOrRequestMetadata}`);

		const wsConnection = this._fetcherService.createWebSocket(endpoint.urlOrRequestMetadata, {
			headers: { ...endpoint.headers, ...request.headers },
		});

		return new QuizWebSocketStreamConnectionImpl(wsConnection);
	}
}

// #endregion

// #region QuizWebSocketStreamConnectionImpl

class QuizWebSocketStreamConnectionImpl implements IQuizWebSocketStreamConnection {

	private readonly _connection: import('../../common/endpoint/quizFetcher.js').IQuizWebSocketConnection;
	private _chunkQueue: IQuizNetworkStreamChunk[] = [];
	private _resolveNext: ((result: IteratorResult<IQuizNetworkStreamChunk>) => void) | null = null;
	private _done = false;

	constructor(connection: import('../../common/endpoint/quizFetcher.js').IQuizWebSocketConnection) {
		this._connection = connection;

		this._connection.onmessage = (ev) => {
			const chunk: IQuizNetworkStreamChunk = {
				data: typeof ev.data === 'string' ? this._tryParseJson(ev.data) : ev.data,
				isFinal: false,
			};
			this._enqueueChunk(chunk);
		};

		this._connection.onclose = (ev) => {
			this._enqueueChunk({
				data: { code: ev.code, reason: ev.reason },
				isFinal: true,
			});
			this._done = true;
			this._resolvePending({ done: true, value: undefined });
		};

		this._connection.onerror = () => {
			this._done = true;
			this._resolvePending({ done: true, value: undefined });
		};
	}

	get stream(): AsyncIterable<IQuizNetworkStreamChunk> {
		return {
			[Symbol.asyncIterator]: () => ({
				next: () => new Promise<IteratorResult<IQuizNetworkStreamChunk>>((resolve) => {
					if (this._chunkQueue.length > 0) {
						const chunk = this._chunkQueue.shift()!;
						resolve({ done: false, value: chunk });
					} else if (this._done) {
						resolve({ done: true, value: undefined });
					} else {
						this._resolveNext = resolve;
					}
				}),
			}),
		};
	}

	send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
		this._connection.send(data);
	}

	close(code?: number, reason?: string): void {
		this._connection.close(code, reason);
	}

	private _enqueueChunk(chunk: IQuizNetworkStreamChunk): void {
		if (this._resolveNext) {
			this._resolveNext({ done: false, value: chunk });
			this._resolveNext = null;
		} else {
			this._chunkQueue.push(chunk);
		}
	}

	private _resolvePending(result: IteratorResult<IQuizNetworkStreamChunk>): void {
		if (this._resolveNext) {
			this._resolveNext(result);
			this._resolveNext = null;
		}
	}

	private _tryParseJson(data: string): unknown {
		try {
			return JSON.parse(data);
		} catch {
			return data;
		}
	}
}

// #endregion
