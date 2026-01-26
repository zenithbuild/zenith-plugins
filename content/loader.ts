import fs from 'node:fs';
import path from 'node:path';
import type { ContentItem, ContentSourceConfig } from './types';
import { compileMarkdown, vnodesToHtml } from './markdown';

export function loadContent(contentDir: string): ContentItem[] {
    if (!fs.existsSync(contentDir)) {
        console.warn(`Content directory ${contentDir} does not exist.`);
        return [];
    }

    const items: ContentItem[] = [];
    const files = getAllFiles(contentDir);

    for (const filePath of files) {
        const ext = path.extname(filePath).toLowerCase();
        const relativePath = path.relative(contentDir, filePath);
        const collection = relativePath.split(path.sep)[0];
        // Ensure slug is forward-slash based and has no leading/trailing slashes
        const slug = relativePath
            .replace(/\.(md|mdx|json)$/, '')
            .split(path.sep)
            .join('/')
            .replace(/^\//, '');
        const id = slug;

        const rawContent = fs.readFileSync(filePath, 'utf-8');

        if (ext === '.json') {
            try {
                const data = JSON.parse(rawContent);
                items.push({
                    id,
                    slug,
                    collection,
                    content: '',
                    ...data
                });
            } catch (e) {
                console.error(`Error parsing JSON file ${filePath}:`, e);
            }
        } else if (ext === '.md' || ext === '.mdx') {
            const { metadata, content: markdownBody } = parseMarkdown(rawContent);
            // Compile markdown to VNodes then to HTML for rendering
            const vnodes = compileMarkdown(markdownBody);
            const compiledContent = vnodesToHtml(vnodes);
            items.push({
                id,
                slug,
                collection,
                content: compiledContent,
                ...metadata
            });
        }
    }
    return items;
}

/**
 * Load content from configured sources
 * Supports include/exclude filtering for folder selection
 */
export function loadFromSources(
    sources: Record<string, ContentSourceConfig>,
    projectRoot: string
): Record<string, ContentItem[]> {
    const collections: Record<string, ContentItem[]> = {};

    for (const [collectionName, config] of Object.entries(sources)) {
        const rootPath = path.resolve(projectRoot, config.root);

        if (!fs.existsSync(rootPath)) {
            console.warn(`[zenith:content] Source root "${rootPath}" does not exist for collection "${collectionName}"`);
            continue;
        }

        // Get folders to scan
        let foldersToScan: string[] = [];

        if (config.include && config.include.length > 0) {
            // Explicit include list
            foldersToScan = config.include;
        } else {
            // Scan all subdirectories if no include specified
            try {
                foldersToScan = fs.readdirSync(rootPath)
                    .filter(f => fs.statSync(path.join(rootPath, f)).isDirectory());
            } catch {
                // If root is itself the content folder
                foldersToScan = ['.'];
            }
        }

        // Apply excludes
        const exclude = config.exclude || [];
        foldersToScan = foldersToScan.filter(f => !exclude.includes(f));

        // Load content from each folder
        const items: ContentItem[] = [];
        for (const folder of foldersToScan) {
            const folderPath = folder === '.' ? rootPath : path.join(rootPath, folder);

            if (!fs.existsSync(folderPath)) {
                console.warn(`[zenith:content] Folder "${folderPath}" does not exist, skipping`);
                continue;
            }

            const folderItems = loadContent(folderPath);

            // Override collection name to match the configured name
            items.push(...folderItems.map(item => ({
                ...item,
                collection: collectionName
            })));
        }

        collections[collectionName] = items;
    }

    return collections;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    files.forEach((file: string) => {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getAllFiles(name, fileList);
        } else {
            fileList.push(name);
        }
    });
    return fileList;
}

function parseMarkdown(content: string): { metadata: Record<string, any>, content: string } {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { metadata: {}, content: content.trim() };
    }

    const [, yamlStr, body] = match;
    const metadata: Record<string, any> = {};

    yamlStr.split('\n').forEach(line => {
        const [key, ...values] = line.split(':');
        if (key && values.length > 0) {
            const value = values.join(':').trim();
            // Basic type conversion
            if (value === 'true') metadata[key.trim()] = true;
            else if (value === 'false') metadata[key.trim()] = false;
            else if (!isNaN(Number(value))) metadata[key.trim()] = Number(value);
            else if (value.startsWith('[') && value.endsWith(']')) {
                metadata[key.trim()] = value.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
            }
            else metadata[key.trim()] = value.replace(/^['"]|['"]$/g, '');
        }
    });

    return { metadata, content: body.trim() };
}
