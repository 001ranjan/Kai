import type { ToolDefinition } from '../types';
import { getPosts, getPages, getPortfolio, getItemById } from './cache';

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'fetch_posts',
    description:
      'Fetches all blog posts and stories from the Kormoan website. Use for questions about articles, insights, design thinking, or written content.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'fetch_pages',
    description:
      'Fetches all website pages (Services, About, Contact, Design for AI, Book a Call, etc.). Use for questions about what Kormoan does, their process, team, or services.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'fetch_portfolio',
    description:
      'Fetches all portfolio/case study items from Kormoan. Use when asked about past work, projects, clients, industries served, or examples of what Kormoan has built.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'fetch_item_details',
    description:
      'Fetches the full content of a specific post, page, or portfolio item by its numeric ID. Use this when you need deeper details about a particular item you already know the ID of.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'The numeric ID of the post, page, or portfolio item',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_content',
    description:
      'Searches across Kormoan website content for a keyword or topic. Returns the most relevant excerpts. Use for specific searches across posts, pages, or portfolio.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The keyword or topic to search for (e.g. "healthcare", "IndusInd", "pricing")',
        },
        source: {
          type: 'string',
          description: 'Where to search',
          enum: ['posts', 'pages', 'portfolio', 'all'],
        },
      },
      required: ['query'],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {

    case 'fetch_posts': {
      const posts = await getPosts();
      if (!posts.length) return 'No posts found.';
      return posts
        .map((p) => `## ${p.title}\nURL: ${p.url}\n${p.content}`)
        .join('\n\n---\n\n');
    }

    case 'fetch_pages': {
      const pages = await getPages();
      if (!pages.length) return 'No pages found.';
      return pages
        .map((p) => `## ${p.title}\nURL: ${p.url}\n${p.content}`)
        .join('\n\n---\n\n');
    }

    case 'fetch_portfolio': {
      const items = await getPortfolio();
      if (!items.length) return 'No portfolio items found.';
      return items
        .map((p) => `## ${p.title}\nURL: ${p.url}\nSummary: ${p.excerpt}\n${p.content}`)
        .join('\n\n---\n\n');
    }

    case 'fetch_item_details': {
      const id = Number(input.id);
      if (!id) return 'Please provide a valid numeric ID.';
      const item = await getItemById(id);
      return `## ${item.title} (${item.type})\nURL: ${item.url}\n${item.content}`;
    }

    case 'search_content': {
      const query = String(input.query ?? '').toLowerCase().trim();
      const source = String(input.source ?? 'all');
      if (!query) return 'Please provide a search query.';

      const results: string[] = [];

      async function searchIn(
        items: Array<{ title: string; url: string; content: string; excerpt?: string }>,
        label: string
      ) {
        for (const p of items) {
          const haystack = `${p.title} ${p.excerpt ?? ''} ${p.content}`.toLowerCase();
          if (haystack.includes(query)) {
            const idx = haystack.indexOf(query);
            const excerpt = p.content.slice(Math.max(0, idx - 100), idx + 400).trim();
            results.push(`[${label}] ${p.title}\nURL: ${p.url}\n…${excerpt}…`);
          }
        }
      }

      if (source === 'posts' || source === 'all')     await searchIn(await getPosts(), 'POST');
      if (source === 'pages' || source === 'all')     await searchIn(await getPages(), 'PAGE');
      if (source === 'portfolio' || source === 'all') await searchIn(await getPortfolio(), 'PORTFOLIO');

      if (!results.length) return `No content found matching "${input.query}".`;
      return results.slice(0, 6).join('\n\n---\n\n');
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
