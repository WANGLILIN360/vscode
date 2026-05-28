/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// #region QuizEmbeddingType (aligned with Copilot's EmbeddingType)

/**
 * Fully qualified type of the embedding.
 * Includes both the model identifier and the dimensions.
 * Aligned with Copilot's EmbeddingType (platform/embeddings/common/embeddingsComputer.ts).
 */
export class QuizEmbeddingType {
	public static readonly text3small_512 = new QuizEmbeddingType('text-embedding-3-small-512');
	public static readonly metis_1024_I16_Binary = new QuizEmbeddingType('metis-1024-I16-Binary');

	constructor(
		public readonly id: string,
	) { }

	public toString(): string {
		return this.id;
	}

	public equals(other: QuizEmbeddingType): boolean {
		return this.id === other.id;
	}
}

// #endregion

// #region QuizLegacyEmbeddingModelId (aligned with Copilot's LEGACY_EMBEDDING_MODEL_ID)

/**
 * Legacy embedding model IDs used in CAPI requests.
 * These values are case-sensitive and must match CAPI exactly.
 * Aligned with Copilot's LEGACY_EMBEDDING_MODEL_ID.
 */
export const enum QuizLegacyEmbeddingModelId {
	TEXT3SMALL = 'text-embedding-3-small',
	Metis_I16_Binary = 'metis-I16-Binary',
}

// #endregion

// #region QuizEmbeddingTypeInfo (aligned with Copilot's EmbeddingTypeInfo)

type QuizEmbeddingQuantization = 'float32' | 'float16' | 'binary';

export interface QuizEmbeddingTypeInfo {
	readonly model: QuizLegacyEmbeddingModelId;
	readonly dimensions: number;
	readonly quantization: {
		readonly query: QuizEmbeddingQuantization;
		readonly document: QuizEmbeddingQuantization;
	};
}

const wellKnownEmbeddingMetadata: Record<string, QuizEmbeddingTypeInfo> = {
	[QuizEmbeddingType.text3small_512.id]: {
		model: QuizLegacyEmbeddingModelId.TEXT3SMALL,
		dimensions: 512,
		quantization: {
			query: 'float32',
			document: 'float32',
		},
	},
	[QuizEmbeddingType.metis_1024_I16_Binary.id]: {
		model: QuizLegacyEmbeddingModelId.Metis_I16_Binary,
		dimensions: 1024,
		quantization: {
			query: 'float16',
			document: 'binary',
		},
	},
};

/**
 * Get well-known embedding type info.
 * Aligned with Copilot's getWellKnownEmbeddingTypeInfo().
 */
export function getQuizEmbeddingTypeInfo(type: QuizEmbeddingType): QuizEmbeddingTypeInfo | undefined {
	return wellKnownEmbeddingMetadata[type.id];
}

// #endregion

// #region QuizEmbedding / QuizEmbeddings (aligned with Copilot's Embedding / Embeddings)

export type QuizEmbeddingVector = readonly number[];

export interface QuizEmbedding {
	readonly type: QuizEmbeddingType;
	readonly value: QuizEmbeddingVector;
}

export interface QuizEmbeddings {
	readonly type: QuizEmbeddingType;
	readonly values: readonly QuizEmbedding[];
}

/**
 * Type guard for valid embeddings.
 * Aligned with Copilot's isValidEmbedding().
 */
export function isValidQuizEmbedding(value: unknown): value is QuizEmbedding {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const asEmbedding = value as QuizEmbedding;
	if (!asEmbedding.type) {
		return false;
	}
	if (!Array.isArray(asEmbedding.value) || asEmbedding.value.length === 0) {
		return false;
	}
	return true;
}

// #endregion

// #region QuizEmbeddingDistance (aligned with Copilot's EmbeddingDistance)

export interface QuizEmbeddingDistance {
	readonly embeddingType: QuizEmbeddingType;
	readonly value: number;
}

/**
 * Compute dot product of two embedding vectors.
 */
function dotProduct(a: QuizEmbeddingVector, b: QuizEmbeddingVector): number {
	if (a.length !== b.length) {
		// Warn but compute with min length
	}
	let result = 0;
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		result += a[i] * b[i];
	}
	return result;
}

/**
 * Gets the similarity score from 0-1 between two embeddings.
 * Aligned with Copilot's distance().
 */
export function quizEmbeddingDistance(queryEmbedding: QuizEmbedding, otherEmbedding: QuizEmbedding): QuizEmbeddingDistance {
	if (!queryEmbedding.type.equals(otherEmbedding.type)) {
		throw new Error(`Embeddings must be of the same type to compute similarity. Got: ${queryEmbedding.type.id} and ${otherEmbedding.type.id}`);
	}

	return {
		embeddingType: queryEmbedding.type,
		value: dotProduct(otherEmbedding.value, queryEmbedding.value),
	};
}

/**
 * Rank the embedding items by their cosine similarity to a query.
 * Aligned with Copilot's rankEmbeddings().
 *
 * @returns The top maxResults items.
 */
export function quizRankEmbeddings<T>(
	queryEmbedding: QuizEmbedding,
	items: ReadonlyArray<readonly [T, QuizEmbedding]>,
	maxResults: number,
	options?: {
		readonly minDistance?: number;
		readonly maxSpread?: number;
	},
): Array<{ readonly value: T; readonly distance: QuizEmbeddingDistance }> {
	const minThreshold = options?.minDistance ?? 0;

	const results = items
		.map(([value, embedding]): { readonly distance: QuizEmbeddingDistance; readonly value: T } => {
			return { distance: quizEmbeddingDistance(queryEmbedding, embedding), value };
		})
		.filter(entry => entry.distance.value > minThreshold)
		.sort((a, b) => b.distance.value - a.distance.value)
		.slice(0, maxResults);

	if (results.length && typeof options?.maxSpread === 'number') {
		const minScore = results.at(0)!.distance.value * (1.0 - options.maxSpread);
		return results.filter(x => x.distance.value >= minScore);
	}

	return results;
}

// #endregion

// #region IQuizEmbeddingsService (aligned with Copilot's IEmbeddingsComputer)

export const IQuizEmbeddingsService = createDecorator<IQuizEmbeddingsService>('quizEmbeddingsService');

export type QuizEmbeddingInputType = 'document' | 'query';

export interface QuizComputeEmbeddingsOptions {
	readonly inputType?: QuizEmbeddingInputType;
}

/**
 * Embeddings computation service.
 * Aligned with Copilot's IEmbeddingsComputer (platform/embeddings/common/embeddingsComputer.ts).
 *
 * Now that Quiz has the QAPI path, embeddings can be computed through
 * the CAPI SDK path (IQuizQAPIClientService with QuizRequestType.ChatCompletions
 * or a dedicated embeddings endpoint).
 *
 * ### Copilot's embeddings flow:
 * 1. IEmbeddingsComputer.computeEmbeddings() → NodeEmbeddingsComputer
 * 2. NodeEmbeddingsComputer sends request via CAPI SDK
 * 3. CAPI SDK routes to the embeddings endpoint
 * 4. Response is parsed into Embeddings objects
 *
 * ### Quiz's embeddings flow:
 * 1. IQuizEmbeddingsService.computeEmbeddings() → QuizEmbeddingsServiceImpl
 * 2. QuizEmbeddingsServiceImpl sends request via IQuizQAPIClientService
 * 3. IQuizQAPIClientService routes through CAPI SDK
 * 4. Response is parsed into QuizEmbeddings objects
 */
export interface IQuizEmbeddingsService {
	readonly _serviceBrand: undefined;

	/**
	 * Computes embeddings for the given strings.
	 * Aligned with Copilot's IEmbeddingsComputer.computeEmbeddings().
	 *
	 * @param type The embedding type (model + dimensions)
	 * @param inputs The strings to compute embeddings for
	 * @param options Options for the computation (input type: document vs query)
	 * @param token Cancellation token
	 * @returns The embeddings, or undefined on failure
	 */
	computeEmbeddings(
		type: QuizEmbeddingType,
		inputs: readonly string[],
		options?: QuizComputeEmbeddingsOptions,
		token?: CancellationToken,
	): Promise<QuizEmbeddings | undefined>;
}

// #endregion

// #region Null implementation

/** Null embeddings service for testing */
export class NullQuizEmbeddingsService implements IQuizEmbeddingsService {
	declare readonly _serviceBrand: undefined;

	async computeEmbeddings(): Promise<QuizEmbeddings | undefined> {
		return undefined;
	}
}

// #endregion
