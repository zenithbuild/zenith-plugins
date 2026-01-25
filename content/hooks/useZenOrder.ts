/**
 * useZenOrder Hook
 * 
 * A plugin-provided hook for organizing and navigating documentation.
 * Provides dynamic folder ordering, slug generation, and navigation helpers.
 * 
 * Features:
 * - Dynamic folder ordering (meta.order → intro tag → alphabetical)
 * - Slug generation for sections and docs
 * - State management for selected section/doc
 * - Navigation helpers (next/prev) with cross-section support
 */

import type { ContentItem } from '../types';

export interface DocItem extends ContentItem {
    slug: string;
    sectionSlug: string;
    isIntro?: boolean;
}

export interface Section {
    id: string;
    title: string;
    slug: string;
    order?: number;
    hasIntro: boolean;
    items: DocItem[];
}

export interface ZenOrderState {
    sections: Section[];
    selectedSection: Section | null;
    selectedDoc: DocItem | null;
}

export interface ZenOrderActions {
    selectSection: (section: Section) => void;
    selectDoc: (doc: DocItem) => void;
    getNextDoc: (currentDoc: DocItem) => DocItem | null;
    getPrevDoc: (currentDoc: DocItem) => DocItem | null;
    getDocBySlug: (sectionSlug: string, docSlug: string) => DocItem | null;
    getSectionBySlug: (sectionSlug: string) => Section | null;
}

export type ZenOrderReturn = ZenOrderState & ZenOrderActions;

/**
 * Generate a URL-safe slug from a string
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single
        .trim();
}

/**
 * Extract slug from file path or title
 */
function getDocSlug(doc: ContentItem): string {
    // Try to use the filename from the slug/id
    const slugOrId = String(doc.slug || doc.id || '');
    const parts = slugOrId.split('/');
    const filename = parts[parts.length - 1];

    // If filename exists and isn't empty, use it
    if (filename && filename.length > 0) {
        return slugify(filename);
    }

    // Fallback to title
    return slugify(doc.title || 'untitled');
}

/**
 * Sort sections dynamically based on:
 * 1. meta.order (absolute priority if defined)
 * 2. Presence of intro doc (soft priority)
 * 3. Alphabetical fallback
 */
function sortSections(sections: Section[]): Section[] {
    return [...sections].sort((a, b) => {
        // 1. Order priority (lower is first)
        if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;

        // 2. Intro priority (sections with intro come first)
        if (a.hasIntro && !b.hasIntro) return -1;
        if (!a.hasIntro && b.hasIntro) return 1;

        // 3. Alphabetical fallback
        return a.title.localeCompare(b.title);
    });
}

/**
 * Sort docs within a section
 * - Intro docs come first
 * - Then by order if defined
 * - Then alphabetical
 */
function sortDocs(docs: DocItem[]): DocItem[] {
    return [...docs].sort((a, b) => {
        // Intro docs first
        if (a.isIntro && !b.isIntro) return -1;
        if (!a.isIntro && b.isIntro) return 1;

        // Order priority
        const orderA = (a as any).order;
        const orderB = (b as any).order;
        if (orderA !== undefined && orderB !== undefined) {
            return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;

        // Alphabetical
        return (a.title || '').localeCompare(b.title || '');
    });
}

/**
 * Process raw sections from zenCollection into structured sections with slugs
 */
export function processRawSections(rawSections: any[]): Section[] {
    const sections: Section[] = rawSections.map(rawSection => {
        const sectionSlug = slugify(rawSection.title || rawSection.id || 'section');

        // Process items with slugs and section reference
        const items: DocItem[] = (rawSection.items || []).map((item: ContentItem) => ({
            ...item,
            slug: getDocSlug(item),
            sectionSlug,
            isIntro: (item as any).intro === true || (item as any).tags?.includes('intro')
        }));

        // Sort items within section
        const sortedItems = sortDocs(items);

        // Check if section has intro doc
        const hasIntro = sortedItems.some(item => item.isIntro);

        // Get section order from first item's folder meta or undefined
        const order = (rawSection as any).order ?? (rawSection as any).meta?.order;

        return {
            id: rawSection.id || sectionSlug,
            title: rawSection.title || 'Untitled Section',
            slug: sectionSlug,
            order,
            hasIntro,
            items: sortedItems
        };
    });

    return sortSections(sections);
}

/**
 * Create the useZenOrder hook
 * 
 * This function creates the hook state and actions.
 * In the Zenith runtime, this would be called during component initialization.
 */
export function createZenOrder(rawSections: any[]): ZenOrderReturn {
    // Process and sort sections
    const sections = processRawSections(rawSections);

    // React to selection changes by updating the returned object's properties
    const actions: ZenOrderActions = {
        selectSection: (section: Section): void => {
            instance.selectedSection = section;
            instance.selectedDoc = section.items[0] || null;
        },

        selectDoc: (doc: DocItem): void => {
            instance.selectedDoc = doc;
            const docSection = sections.find(s => s.slug === doc.sectionSlug);
            if (docSection) {
                instance.selectedSection = docSection;
            }
        },

        getSectionBySlug: (sectionSlug: string): Section | null => {
            return sections.find(s => s.slug === sectionSlug) || null;
        },

        getDocBySlug: (sectionSlug: string, docSlug: string): DocItem | null => {
            const section = sections.find(s => s.slug === sectionSlug);
            if (!section) return null;
            return section.items.find(d => d.slug === docSlug) || null;
        },

        getNextDoc: (currentDoc: DocItem): DocItem | null => {
            const currentSection = sections.find(s => s.slug === currentDoc.sectionSlug);
            if (!currentSection) return null;

            const currentIndex = currentSection.items.findIndex(d => d.slug === currentDoc.slug);

            if (currentIndex < currentSection.items.length - 1) {
                return currentSection.items[currentIndex + 1];
            }

            const sectionIndex = sections.findIndex(s => s.slug === currentSection.slug);
            if (sectionIndex < sections.length - 1) {
                const nextSection = sections[sectionIndex + 1];
                return nextSection.items[0] || null;
            }

            return null;
        },

        getPrevDoc: (currentDoc: DocItem): DocItem | null => {
            const currentSection = sections.find(s => s.slug === currentDoc.sectionSlug);
            if (!currentSection) return null;

            const currentIndex = currentSection.items.findIndex(d => d.slug === currentDoc.slug);

            if (currentIndex > 0) {
                return currentSection.items[currentIndex - 1];
            }

            const sectionIndex = sections.findIndex(s => s.slug === currentSection.slug);
            if (sectionIndex > 0) {
                const prevSection = sections[sectionIndex - 1];
                return prevSection.items[prevSection.items.length - 1] || null;
            }

            return null;
        }
    };

    const instance: ZenOrderReturn = {
        sections,
        selectedSection: sections[0] || null,
        selectedDoc: sections[0]?.items[0] || null,
        ...actions
    };

    return instance;
}

/**
 * Build a documentation URL from section and doc slugs
 */
export function buildDocUrl(sectionSlug: string, docSlug?: string): string {
    if (!docSlug || docSlug === 'index') {
        return `/documentation/${sectionSlug}`;
    }
    return `/documentation/${sectionSlug}/${docSlug}`;
}

/**
 * Parse slugs from a URL path
 */
export function parseDocUrl(path: string): { sectionSlug: string | null; docSlug: string | null } {
    const match = path.match(/^\/documentation\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) {
        return { sectionSlug: null, docSlug: null };
    }
    return {
        sectionSlug: match[1] || null,
        docSlug: match[2] || null
    };
}

// Default export for easy importing
export default {
    createZenOrder,
    processRawSections,
    buildDocUrl,
    parseDocUrl,
    slugify
};
