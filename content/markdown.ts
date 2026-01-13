/**
 * Markdown to Zenith Render Nodes Compiler
 * 
 * Converts markdown content to Zenith-compatible VNodes at build/load time.
 * This ensures markdown is fully compiled before reaching the frontend.
 * 
 * Supported syntax:
 * - Headings (#, ##, ###, ####, #####, ######)
 * - Paragraphs
 * - Bold (**text** or __text__)
 * - Italic (*text* or _text_)
 * - Inline code (`code`)
 * - Code blocks (```language\ncode\n```)
 * - Links ([text](url))
 * - Horizontal rules (---, ***, ___)
 * - Lists (- item, * item, 1. item)
 * - Blockquotes (> text)
 */

/**
 * VNode - Virtual DOM node structure compatible with Zenith runtime
 */
export interface VNode {
    tag: string;
    props: Record<string, string | null>;
    children: (VNode | string)[];
}

/**
 * Create a VNode element
 */
function h(tag: string, props: Record<string, string | null> = {}, children: (VNode | string)[] = []): VNode {
    return { tag, props, children };
}

/**
 * Escape HTML entities in text
 */
function escapeText(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Parse inline markdown (bold, italic, code, links)
 */
function parseInline(text: string): (VNode | string)[] {
    const result: (VNode | string)[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Bold: **text** or __text__
        let match = remaining.match(/^(\*\*|__)(.+?)\1/);
        if (match) {
            result.push(h('strong', {}, [match[2]]));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Italic: *text* or _text_ (but not ** or __)
        match = remaining.match(/^(\*|_)(?!\1)(.+?)\1(?!\1)/);
        if (match) {
            result.push(h('em', {}, [match[2]]));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Inline code: `code`
        match = remaining.match(/^`([^`]+)`/);
        if (match) {
            result.push(h('code', {}, [match[1]]));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Links: [text](url)
        match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
            result.push(h('a', { href: match[2] }, [match[1]]));
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Find next special character or consume until end
        const nextSpecial = remaining.slice(1).search(/[\*_`\[]/);
        if (nextSpecial === -1) {
            result.push(remaining);
            break;
        } else {
            result.push(remaining.slice(0, nextSpecial + 1));
            remaining = remaining.slice(nextSpecial + 1);
        }
    }

    return result;
}

/**
 * Compile markdown string to VNode array
 */
export function compileMarkdown(markdown: string): VNode[] {
    const nodes: VNode[] = [];
    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (trimmed === '') {
            i++;
            continue;
        }

        // Code blocks: ```language\ncode\n```
        if (trimmed.startsWith('```')) {
            const lang = trimmed.slice(3).trim() || null;
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // Skip closing ```

            const codeContent = codeLines.join('\n');
            const codeNode = h('code', lang ? { class: `language-${lang}` } : {}, [codeContent]);
            nodes.push(h('pre', {}, [codeNode]));
            continue;
        }

        // Headings: # to ######
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const text = headingMatch[2];
            nodes.push(h(`h${level}`, {}, parseInline(text)));
            i++;
            continue;
        }

        // Horizontal rules: ---, ***, ___
        if (/^([-*_])\1{2,}$/.test(trimmed)) {
            nodes.push(h('hr', {}, []));
            i++;
            continue;
        }

        // Blockquotes: > text
        if (trimmed.startsWith('>')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quoteLines.push(lines[i].trim().slice(1).trim());
                i++;
            }
            const quoteContent = quoteLines.join(' ');
            nodes.push(h('blockquote', {}, parseInline(quoteContent)));
            continue;
        }

        // Unordered lists: - item, * item
        if (/^[-*]\s+/.test(trimmed)) {
            const listItems: VNode[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^[-*]\s+/, '');
                listItems.push(h('li', {}, parseInline(itemText)));
                i++;
            }
            nodes.push(h('ul', {}, listItems));
            continue;
        }

        // Ordered lists: 1. item
        if (/^\d+\.\s+/.test(trimmed)) {
            const listItems: VNode[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
                listItems.push(h('li', {}, parseInline(itemText)));
                i++;
            }
            nodes.push(h('ol', {}, listItems));
            continue;
        }

        // Paragraph: collect consecutive non-empty lines
        const paraLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '' &&
            !lines[i].trim().startsWith('#') &&
            !lines[i].trim().startsWith('```') &&
            !lines[i].trim().startsWith('>') &&
            !/^[-*]\s+/.test(lines[i].trim()) &&
            !/^\d+\.\s+/.test(lines[i].trim()) &&
            !/^([-*_])\1{2,}$/.test(lines[i].trim())) {
            paraLines.push(lines[i].trim());
            i++;
        }

        if (paraLines.length > 0) {
            const paraText = paraLines.join(' ');
            nodes.push(h('p', {}, parseInline(paraText)));
        }
    }

    return nodes;
}

/**
 * Convert VNode tree to HTML string for rendering in innerHTML
 * This is used as an intermediate step for browser rendering
 */
export function vnodesToHtml(nodes: VNode[]): string {
    function renderNode(node: VNode | string): string {
        if (typeof node === 'string') {
            return escapeText(node);
        }

        const { tag, props, children } = node;

        // Self-closing tags
        if (tag === 'hr' || tag === 'br') {
            const attrs = Object.entries(props)
                .filter(([_, v]) => v !== null)
                .map(([k, v]) => `${k}="${v}"`)
                .join(' ');
            return attrs ? `<${tag} ${attrs} />` : `<${tag} />`;
        }

        const attrs = Object.entries(props)
            .filter(([_, v]) => v !== null)
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');

        const childrenHtml = children.map(renderNode).join('');

        return attrs
            ? `<${tag} ${attrs}>${childrenHtml}</${tag}>`
            : `<${tag}>${childrenHtml}</${tag}>`;
    }

    return nodes.map(renderNode).join('\n');
}
