/**
 * Zenith Content Plugin
 * 
 * A data provider plugin for loading content from markdown and JSON files.
 * 
 * Usage in zenith.config.ts:
 * ```typescript
 * import { defineConfig } from 'zenith/config';
 * import content from 'zenith-content';
 * 
 * export default defineConfig({
 *   plugins: [
 *     content({
 *       sources: {
 *         docs: {
 *           root: '../zenith-docs',
 *           include: ['documentation']
 *         }
 *       }
 *     })
 *   ]
 * });
 * ```
 */

import type { ContentItem, ContentPluginOptions, ContentSourceConfig } from "./types";
import { loadContent, loadFromSources } from "./loader";
import { ZenCollection } from "./query";
import { defineSchema } from "./schema";
import path from "node:path";

// Re-exports for convenience
export { defineSchema } from "./schema";
export { ZenCollection } from "./query";
export type { ContentItem, ContentPluginOptions, ContentSourceConfig } from "./types";

// Export useZenOrder hook and utilities
export {
  createZenOrder,
  processRawSections,
  buildDocUrl,
  parseDocUrl
} from "./hooks/useZenOrder";
export type {
  DocItem,
  Section,
  ZenOrderState,
  ZenOrderActions,
  ZenOrderReturn
} from "./hooks/useZenOrder";

// Store for loaded content (used by legacy zenQuery)
let allContent: ContentItem[] = [];

/**
 * Legacy query function - use zenCollection in templates instead
 */
export const zenQuery = (collection: string) => {
  const items = allContent.filter(item => item.collection === collection);
  return new ZenCollection(items);
};

/**
 * Plugin interface expected by core
 */
export interface ZenithPlugin {
  name: string;
  setup: (ctx: PluginContext) => void | Promise<void>;
  config?: unknown;
}

/**
 * Context provided to plugins during setup
 */
export interface PluginContext {
  projectRoot: string;
  setContentData: (data: Record<string, ContentItem[]>) => void;
  options?: Record<string, unknown>;
}

/**
 * Content plugin factory function
 * 
 * @param options - Plugin configuration with sources
 * @returns A ZenithPlugin that loads content from configured sources
 */
export default function content(options: ContentPluginOptions = {}): ZenithPlugin {
  return {
    name: 'zenith-content',
    config: options,
    setup(ctx: PluginContext) {
      let collections: Record<string, ContentItem[]> = {};

      if (options.sources && Object.keys(options.sources).length > 0) {
        // Use new sources configuration
        collections = loadFromSources(options.sources, ctx.projectRoot);
      } else if (options.contentDir) {
        // Legacy: single content directory
        const contentPath = path.resolve(ctx.projectRoot, options.contentDir);
        const items = loadContent(contentPath);

        // Group by collection
        for (const item of items) {
          const collection = item.collection || 'default';
          if (!collections[collection]) {
            collections[collection] = [];
          }
          collections[collection].push(item);
        }

        console.log(`[zenith:content] Loaded ${items.length} items from ${options.contentDir}`);
      }

      // Pass to runtime
      ctx.setContentData(collections);

      // Update legacy storage
      allContent = Object.values(collections).flat();
    }
  };
}

/**
 * Legacy plugin export for backward compatibility
 * @deprecated Use the default export factory function instead
 */
export const plugin: ZenithPlugin = {
  name: "content",
  setup(ctx: PluginContext) {
    const contentDir = path.resolve(ctx.projectRoot, "content");
    const items = loadContent(contentDir);

    // Group by collection
    const collections: Record<string, ContentItem[]> = {};
    for (const item of items) {
      const collection = item.collection || 'default';
      if (!collections[collection]) {
        collections[collection] = [];
      }
      collections[collection].push(item);
    }

    allContent = items;
    ctx.setContentData(collections);

    console.log(`[zenith:content] Loaded ${items.length} items from ${contentDir}`);
  }
};
