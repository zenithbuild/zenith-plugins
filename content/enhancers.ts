import type { ContentItem, EnhancerFn } from './types';

export const builtInEnhancers: Record<string, EnhancerFn> = {
    readTime: (item: ContentItem) => {
        const wordsPerMinute = 200;
        const text = item.content || '';
        const wordCount = text.split(/\s+/).length;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return {
            ...item,
            readTime: `${minutes} min`
        };
    },
    wordCount: (item: ContentItem) => {
        const text = item.content || '';
        const wordCount = text.split(/\s+/).length;
        return {
            ...item,
            wordCount
        };
    }
};

export async function applyEnhancers(item: ContentItem, enhancers: (string | EnhancerFn)[]): Promise<ContentItem> {
    let enrichedItem = { ...item };
    for (const enhancer of enhancers) {
        if (typeof enhancer === 'string') {
            const fn = builtInEnhancers[enhancer];
            if (fn) {
                enrichedItem = await fn(enrichedItem);
            } else {
                console.warn(`Enhancer "${enhancer}" not found.`);
            }
        } else if (typeof enhancer === 'function') {
            enrichedItem = await enhancer(enrichedItem);
        }
    }
    return enrichedItem;
}
