import type { ContentItem, SortOrder, Enhancer } from './types';
import { applyEnhancers } from './enhancers';

export class ZenCollection {
    private collectionItems: ContentItem[];
    private filters: ((item: ContentItem) => boolean)[] = [];
    private sortField: string | null = null;
    private sortOrder: SortOrder = 'desc';
    private limitCount: number | null = null;
    private selectedFields: string[] | null = null;
    private enhancers: Enhancer[] = [];

    constructor(items: ContentItem[]) {
        this.collectionItems = [...items];
    }

    where(fn: (item: ContentItem) => boolean): this {
        this.filters.push(fn);
        return this;
    }

    sortBy(field: string, order: SortOrder = 'desc'): this {
        this.sortField = field;
        this.sortOrder = order;
        return this;
    }

    limit(n: number): this {
        this.limitCount = n;
        return this;
    }

    fields(fields: string[]): this {
        this.selectedFields = fields;
        return this;
    }

    enhanceWith(enhancer: Enhancer): this {
        this.enhancers.push(enhancer);
        return this;
    }

    async get(): Promise<ContentItem[]> {
        let results = [...this.collectionItems];

        // 1. Filter
        for (const filter of this.filters) {
            results = results.filter(filter);
        }

        // 2. Sort
        if (this.sortField) {
            results.sort((a, b) => {
                const valA = a[this.sortField!];
                const valB = b[this.sortField!];

                if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // 3. Limit
        if (this.limitCount !== null) {
            results = results.slice(0, this.limitCount);
        }

        // 4. Enhance
        if (this.enhancers.length > 0) {
            results = await Promise.all(results.map(item => applyEnhancers(item, this.enhancers)));
        }

        // 5. Select Fields
        if (this.selectedFields) {
            results = results.map(item => {
                const newItem: any = {};
                this.selectedFields!.forEach(f => {
                    newItem[f] = item[f];
                });
                return newItem as ContentItem;
            });
        }

        return results;
    }

    async all(): Promise<ContentItem[]> {
        return this.get();
    }

    async first(): Promise<ContentItem | null> {
        const results = await this.limit(1).get();
        return results.length > 0 ? results[0] : null;
    }

    async count(): Promise<number> {
        const results = await this.get();
        return results.length;
    }

    /**
     * Group items by folder (first segment of slug).
     * Returns an object with a groupByFolder method that can be chained.
     */
    groupByFolder(): { get: () => Array<{ id: string; title: string; items: ContentItem[] }> } {
        const self = this;
        return {
            get(): Array<{ id: string; title: string; items: ContentItem[] }> {
                let results = [...self.collectionItems];

                // 1. Filter
                for (const filter of self.filters) {
                    results = results.filter(filter);
                }

                // 2. Sort
                if (self.sortField) {
                    results.sort((a, b) => {
                        const valA = a[self.sortField!];
                        const valB = b[self.sortField!];

                        if (valA < valB) return self.sortOrder === 'asc' ? -1 : 1;
                        if (valA > valB) return self.sortOrder === 'asc' ? 1 : -1;
                        return 0;
                    });
                }

                // 3. Limit
                if (self.limitCount !== null) {
                    results = results.slice(0, self.limitCount);
                }

                // Group by folder (first segment of slug)
                const groups = new Map<string, ContentItem[]>();
                for (const item of results) {
                    const slug = String(item.slug || item.id || '');
                    const parts = slug.split('/');
                    const folder = parts.length > 1 ? parts[0] : 'default';

                    if (!groups.has(folder)) {
                        groups.set(folder, []);
                    }
                    groups.get(folder)!.push(item);
                }

                // Convert to array of sections
                const sections: Array<{ id: string; title: string; items: ContentItem[] }> = [];
                for (const [folder, items] of groups) {
                    // Generate title from folder name
                    const title = folder
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');

                    sections.push({
                        id: folder,
                        title,
                        items
                    });
                }

                return sections;
            }
        };
    }
}
