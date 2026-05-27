/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Aligned with Copilot's tools/common/toJsonSchema.ts

export interface IQuizToJsonSchemaOptions {
	/**
	 * Whether to include a description field (empty by default).
	 */
	includeDescription?: boolean;
}

/**
 * Generates a JSON schema from a plain JavaScript object.
 * The input should be a JSON-serializable value.
 * Aligned with Copilot's toJsonSchema().
 */
export function quizToJsonSchema(obj: unknown, options: IQuizToJsonSchemaOptions = {}): Record<string, unknown> {
	if (obj === null) {
		return { type: 'null' };
	}

	switch (typeof obj) {
		case 'string':
			return { type: 'string' };
		case 'number':
			return { type: Number.isInteger(obj) ? 'integer' : 'number' };
		case 'boolean':
			return { type: 'boolean' };
		case 'object':
			if (Array.isArray(obj)) {
				return quizToArraySchema(obj, options);
			}
			return quizToObjectSchema(obj as Record<string, unknown>, options);
		default:
			// For undefined or other non-JSON types, return empty schema
			return {};
	}
}

function quizToArraySchema(arr: unknown[], options: IQuizToJsonSchemaOptions): Record<string, unknown> {
	if (arr.length === 0) {
		return { type: 'array' };
	}

	// Check if all elements are non-null objects (not arrays)
	const allObjects = arr.every(item => item !== null && typeof item === 'object' && !Array.isArray(item));

	if (allObjects) {
		const itemSchema = quizMergeObjectSchemas(arr as Record<string, unknown>[], options);
		return {
			type: 'array',
			items: itemSchema,
		};
	}

	// Collect unique schemas for different types
	const schemas = quizGetUniqueSchemas(arr, options);

	if (schemas.length === 1) {
		return {
			type: 'array',
			items: schemas[0],
		};
	}

	// Multiple different types, use oneOf
	return {
		type: 'array',
		items: { oneOf: schemas },
	};
}

function quizGetSchemaKey(schema: Record<string, unknown>): string {
	if (Object.prototype.hasOwnProperty.call(schema, 'type')) {
		if (schema.type === 'object') {
			return 'object';
		}
		if (schema.type === 'array') {
			return 'array';
		}
		return String(schema.type);
	}
	return JSON.stringify(schema);
}

function quizGetUniqueSchemas(arr: unknown[], options: IQuizToJsonSchemaOptions): Record<string, unknown>[] {
	const schemaMap = new Map<string, Record<string, unknown>>();
	const objectValues: Record<string, unknown>[] = [];

	for (const item of arr) {
		if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
			objectValues.push(item as Record<string, unknown>);
			continue;
		}

		const schema = quizToJsonSchema(item, options);
		const key = quizGetSchemaKey(schema);
		if (!schemaMap.has(key)) {
			schemaMap.set(key, schema);
		}
	}

	if (objectValues.length > 0) {
		schemaMap.set('object', quizMergeObjectSchemas(objectValues, options));
	}

	return Array.from(schemaMap.values());
}

function quizMergeObjectSchemas(objects: Record<string, unknown>[], options: IQuizToJsonSchemaOptions): Record<string, unknown> {
	const propertyValues = new Map<string, unknown[]>();

	for (const obj of objects) {
		for (const [key, value] of Object.entries(obj)) {
			if (!propertyValues.has(key)) {
				propertyValues.set(key, []);
			}
			propertyValues.get(key)!.push(value);
		}
	}

	const properties: Record<string, Record<string, unknown>> = {};
	const required: string[] = [];

	for (const [key, values] of propertyValues) {
		properties[key] = quizMergeValues(values, options);
		// Only mark as required if present in all objects
		if (values.length === objects.length) {
			required.push(key);
		}
	}

	const schema: Record<string, unknown> = {
		type: 'object',
		properties,
	};

	if (required.length > 0) {
		schema.required = required;
	}

	return schema;
}

function quizMergeValues(values: unknown[], options: IQuizToJsonSchemaOptions): Record<string, unknown> {
	const allObjects = values.every(v => v !== null && typeof v === 'object' && !Array.isArray(v));

	if (allObjects) {
		return quizMergeObjectSchemas(values as Record<string, unknown>[], options);
	}

	const schemas = quizGetUniqueSchemas(values, options);

	if (schemas.length === 1) {
		return schemas[0];
	}

	return { oneOf: schemas };
}

function quizToObjectSchema(obj: Record<string, unknown>, options: IQuizToJsonSchemaOptions): Record<string, unknown> {
	const properties: Record<string, Record<string, unknown>> = {};
	const required: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		properties[key] = quizToJsonSchema(value, options);
		required.push(key);
	}

	const schema: Record<string, unknown> = {
		type: 'object',
		properties,
	};

	if (required.length > 0) {
		schema.required = required;
	}

	return schema;
}
