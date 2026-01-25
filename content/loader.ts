import fs from 'node:fs';
import path from 'node:path';
import type { ContentItem, ContentSourceConfig } from './types';
import { compileMarkdown, vnodesToHtml } from './markdown';

export function loadContent(contentDir: string): ContentItem[] {
    console.log(`[zenith:content:loadContent] Starting for: ${contentDir}`);
    if (!fs.existsSync(contentDir)) {
        console.warn(`Content directory ${contentDir} does not exist.`);
        return [];
    }

    const items: ContentItem[] = [];
    console.log('[zenith:content:loadContent] Getting all files...');
    const files = getAllFiles(contentDir);
    console.log(`[zenith:content:loadContent] Found ${files.length} files`);

    for (const filePath of files) {
        console.log(`[zenith:content:loadContent] Processing file: ${path.basename(filePath)}`);
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
            console.log(`[zenith:content:loadContent] Parsing markdown: ${path.basename(filePath)}`);
            const { metadata, content: markdownBody } = parseMarkdown(rawContent);
            console.log(`[zenith:content:loadContent] Compiling markdown...`);
            // Compile markdown to VNodes then to HTML for rendering
            const vnodes = compileMarkdown(markdownBody);
            console.log(`[zenith:content:loadContent] Converting vnodes to HTML...`);
            const compiledContent = vnodesToHtml(vnodes);
            console.log(`[zenith:content:loadContent] Done with: ${path.basename(filePath)}`);
            items.push({
                id,
                slug,
                collection,
                content: compiledContent,
                ...metadata
            });
        }
    }
    console.log(`[zenith:content:loadContent] Finished, returning ${items.length} items`);
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
    console.log('[zenith:content:loader] loadFromSources called, sources:', Object.keys(sources));
    const collections: Record<string, ContentItem[]> = {};

    for (const [collectionName, config] of Object.entries(sources)) {
        console.log(`[zenith:content:loader] Processing collection: ${collectionName}`);
        const rootPath = path.resolve(projectRoot, config.root);
        console.log(`[zenith:content:loader] Root path: ${rootPath}`);

        if (!fs.existsSync(rootPath)) {
            console.warn(`[zenith:content] Source root "${rootPath}" does not exist for collection "${collectionName}"`);
            continue;
        }
        console.log('[zenith:content:loader] Root path exists, scanning folders...');

        // Get folders to scan
        let foldersToScan: string[] = [];

        if (config.include && config.include.length > 0) {
            // Explicit include list
            console.log('[zenith:content:loader] Using explicit include list:', config.include);
            foldersToScan = config.include;
        } else {
            // Scan all subdirectories if no include specified
            try {
                console.log('[zenith:content:loader] Reading subdirectories...');
                foldersToScan = fs.readdirSync(rootPath)
                    .filter(f => fs.statSync(path.join(rootPath, f)).isDirectory());
                console.log('[zenith:content:loader] Found subdirectories:', foldersToScan);
            } catch {
                // If root is itself the content folder
                foldersToScan = ['.'];
            }
        }

        // Apply excludes
        const exclude = config.exclude || [];
        foldersToScan = foldersToScan.filter(f => !exclude.includes(f));
        console.log('[zenith:content:loader] Folders after exclude filter:', foldersToScan);

        // Load content from each folder
        const items: ContentItem[] = [];
        for (const folder of foldersToScan) {
            console.log(`[zenith:content:loader] Processing folder: ${folder}`);
            const folderPath = folder === '.' ? rootPath : path.join(rootPath, folder);

            if (!fs.existsSync(folderPath)) {
                console.warn(`[zenith:content] Folder "${folderPath}" does not exist, skipping`);
                continue;
            }

            console.log(`[zenith:content:loader] Calling loadContent for: ${folderPath}`);
            const folderItems = loadContent(folderPath);
            console.log(`[zenith:content:loader] loadContent returned ${folderItems.length} items`);

            // Override collection name to match the configured name
            items.push(...folderItems.map(item => ({
                ...item,
                collection: collectionName
            })));
        }

        collections[collectionName] = items;
        console.log(`[zenith:content] Loaded ${items.length} items for collection "${collectionName}"`);
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
