/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IQuizEndpointInfoService, IQuizEndpointInfo } from '../../common/quizPlatformServices.js';
import { IQuizEndpointProvider } from '../../common/endpoint/quizEndpoint.js';

// #region QuizEndpointInfoServiceImpl (aligned with Copilot's IChatEndpoint read-only subset)

/**
 * Browser-layer implementation of IQuizEndpointInfoService.
 * Bridges IQuizEndpointProvider to provide lightweight endpoint info
 * for prompt building decisions without exposing request-sending capabilities.
 *
 * Aligned with the read-only subset of Copilot's IChatEndpoint.
 */
export class QuizEndpointInfoServiceImpl extends Disposable implements IQuizEndpointInfoService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeModels = this._register(new Emitter<void>());
	readonly onDidChangeModels: Event<void> = this._onDidChangeModels.event;

	private readonly _endpointInfosCache = new Map<string, IQuizEndpointInfo>();

	constructor(
		@IQuizEndpointProvider private readonly _endpointProvider: IQuizEndpointProvider,
	) {
		super();

		// Forward model change events from the endpoint provider
		this._register(_endpointProvider.onDidChangeModels(() => {
			this._endpointInfosCache.clear();
			this._onDidChangeModels.fire();
		}));
	}

	async getDefaultEndpointInfo(): Promise<IQuizEndpointInfo | undefined> {
		const defaultEndpoint = await this._endpointProvider.getDefaultEndpoint();
		if (!defaultEndpoint) { return undefined; }
		return this._getOrCacheEndpointInfo(defaultEndpoint.modelId, defaultEndpoint);
	}

	async getEndpointInfo(modelId: string): Promise<IQuizEndpointInfo | undefined> {
		const cached = this._endpointInfosCache.get(modelId);
		if (cached) { return cached; }

		const endpoint = await this._endpointProvider.getEndpoint(modelId);
		if (!endpoint) { return undefined; }
		return this._getOrCacheEndpointInfo(modelId, endpoint);
	}

	async getAllEndpointInfos(): Promise<readonly IQuizEndpointInfo[]> {
		const endpoints = await this._endpointProvider.getAllEndpoints();
		return endpoints.map(ep => this._getOrCacheEndpointInfo(ep.modelId, ep));
	}

	private _getOrCacheEndpointInfo(modelId: string, endpoint: { toEndpointInfo: () => IQuizEndpointInfo }): IQuizEndpointInfo {
		const cached = this._endpointInfosCache.get(modelId);
		if (cached) { return cached; }

		const info = endpoint.toEndpointInfo();
		this._endpointInfosCache.set(modelId, info);
		return info;
	}
}

// #endregion
