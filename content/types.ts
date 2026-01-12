export interface ContentItem {
  id?: string | number;
  slug?: string | null;
  collection?: string | null;
  content?: string | null;
  [key: string]: any | null;
}

/**
 * Configuration for a content source
 */
export interface ContentSourceConfig {
  /** Root directory relative to project root (e.g., "../zenith-docs" or "content") */
  root: string;
  /** Folders to include from the root (e.g., ["documentation"]). Defaults to all. */
  include?: string[];
  /** Folders to exclude from the root (e.g., ["changelog"]) */
  exclude?: string[];
}

/**
 * Options for the content plugin factory function
 */
export interface ContentPluginOptions {
  /** Named content sources mapped to their configuration */
  sources?: Record<string, ContentSourceConfig>;
  /** Legacy: Single content directory (deprecated, use sources instead) */
  contentDir?: string;
}

export type ContentSchema = Record<string, 'string' | 'number' | 'boolean' | 'string[]' | 'date'>;

export interface PluginOptions {
  contentDir?: string; // Default: 'content'
}

export type SortOrder = 'asc' | 'desc';

export type EnhancerFn = (item: ContentItem) => ContentItem | Promise<ContentItem>;
export type Enhancer = string | EnhancerFn;

export interface PluginContext {
  options: PluginOptions;
  // Add other context methods if known, for now minimal
  [key: string]: any;
}

export interface ZenithPlugin {
  name: string;
  template?: string;
  options?: PluginOptions;
  setup: (ctx: PluginContext) => void | Promise<void>;
}
