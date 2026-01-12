import type { ContentSchema } from './types';

const schemaRegistry = new Map<string, ContentSchema>();

export function defineSchema(name: string, schema: ContentSchema) {
    schemaRegistry.set(name, schema);
}

export function getSchema(name: string): ContentSchema | undefined {
    return schemaRegistry.get(name);
}

export function validateItem(collection: string, item: any): boolean {
    const schema = getSchema(collection);
    if (!schema) return true; // No schema, no validation (or permissive)

    // Basic validation logic
    for (const [key, type] of Object.entries(schema)) {
        const value = item[key];
        if (value === undefined) continue; // Optional by default?

        if (type === 'string' && typeof value !== 'string') return false;
        if (type === 'number' && typeof value !== 'number') return false;
        if (type === 'boolean' && typeof value !== 'boolean') return false;
        if (type === 'string[]' && (!Array.isArray(value) || !value.every(v => typeof v === 'string'))) return false;
        // ... more types
    }

    return true;
}
