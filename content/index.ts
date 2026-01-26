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
  registerCLI?: (api: CLIBridgeAPI) => void;
}

/**
 * Context provided to plugins during setup (matches core generic signature)
 */
export interface PluginContext {
  projectRoot: string;
  setPluginData: (namespace: string, data: unknown[]) => void;
  options?: Record<string, unknown>;
}

/**
 * CLI Bridge API for hook registration
 * Matches core's CLIBridgeAPI interface
 */
export interface CLIBridgeAPI {
  on(hook: string, handler: (ctx: HookContext) => unknown | void): void;
}

/**
 * Hook context passed to CLI hooks
 */
export interface HookContext {
  projectRoot: string;
  getPluginData: (namespace: string) => unknown;
  [key: string]: unknown;
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


      }

      // Pass to runtime using generic namespaced data store
      const allItems = Object.values(collections).flat();
      ctx.setPluginData('content', allItems);

      // Update legacy storage
      allContent = allItems;

    },

    /**
     * CLI Registration - Plugin owns its CLI behavior
     * 
     * Registers namespaced hooks for CLI lifecycle events.
     * The CLI never calls plugin logic directly - it dispatches hooks.
     */
    registerCLI(api: CLIBridgeAPI) {
      // Register for runtime data collection
      // CLI collects payloads and serializes to window.__ZENITH_PLUGIN_DATA__
      api.on('cli:runtime:collect', (ctx: HookContext) => {
        const data = ctx.getPluginData('content');
        if (!data) return;

        return {
          namespace: 'content',
          payload: data
        };
      });

      // Register for file change events (plugin decides what to do)
      api.on('cli:dev:file-change', (ctx: HookContext) => {
        const filename = ctx.filename as string | undefined;
        if (!filename) return;

        // Plugin owns knowledge of what files it cares about
        if (filename.startsWith('content') || filename.endsWith('.md') || filename.endsWith('.mdx')) {
          // Signal that content should be reloaded
          // The actual reload happens via plugin re-initialization

        }
      });
    }
  };
}

/**
 * Legacy plugin export for backward compatibility
 * @deprecated Use the default export factory function instead
 */
export const plugin: ZenithPlugin = {
  name: "zenith-content",
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
    ctx.setPluginData('content', items);


  },

  registerCLI(api: CLIBridgeAPI) {
    api.on('cli:runtime:collect', (ctx: HookContext) => {
      const data = ctx.getPluginData('content');
      if (!data) return;
      return { namespace: 'content', payload: data };
    });
  }
};

