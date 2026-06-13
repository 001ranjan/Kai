import type { WpPage, WpPortfolio, WpPost } from '../types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

let postsCache: CacheEntry<WpPost[]> | null = null;
let pagesCache: CacheEntry<WpPage[]> | null = null;
let portfolioCache: CacheEntry<WpPortfolio[]> | null = null;

const BASE = 'https://www.kormoan.in/wp-json/ai/v1';
const WP_POSTS_URL     = `${BASE}/all-posts`;
const WP_PAGES_URL     = `${BASE}/all-pages`;
const WP_PORTFOLIO_URL = `${BASE}/all-portfolio`;

function stripHtml(html: string): string {
  return html
    // Remove entire style/script blocks
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove VC shortcodes that wrap raw HTML/SVG
    .replace(/\[vc_raw_html[^\]]*\][\s\S]*?\[\/vc_raw_html\]/gi, '')
    .replace(/\[vc_raw_js[^\]]*\][\s\S]*?\[\/vc_raw_js\]/gi, '')
    // Remove all remaining shortcode tags
    .replace(/\[\/[\w-]+\]/g, ' ')
    .replace(/\[[\w-]+[^\]]*?\/\]/g, ' ')
    .replace(/\[[\w-]+[^\]]*?\]/g, ' ')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    // Remove inline CSS fragments
    .replace(/[a-z-]+\s*:\s*[^;{}"'\s][^;{}"']*;/gi, '')
    // Collapse whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

async function wpFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`WP API error ${res.status} — ${url}`);
  return res.json() as Promise<T>;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(): Promise<WpPost[]> {
  if (postsCache && !isExpired(postsCache)) return postsCache.data;

  const raw = await wpFetch<Array<{ id: number; title: string; url: string; content: string; thumbnail?: string }>>(WP_POSTS_URL);

  const data: WpPost[] = raw.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    content: stripHtml(p.content).slice(0, 2000),
    thumbnail: p.thumbnail,
  }));

  postsCache = { data, fetchedAt: Date.now() };
  return data;
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function getPages(): Promise<WpPage[]> {
  if (pagesCache && !isExpired(pagesCache)) return pagesCache.data;

  const raw = await wpFetch<Array<{ id: number; title: string; url: string; content: string }>>(WP_PAGES_URL);

  const data: WpPage[] = raw.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    content: stripHtml(p.content).slice(0, 3000),
  }));

  pagesCache = { data, fetchedAt: Date.now() };
  return data;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export async function getPortfolio(): Promise<WpPortfolio[]> {
  if (portfolioCache && !isExpired(portfolioCache)) return portfolioCache.data;

  const raw = await wpFetch<Array<{
    id: number; title: string; url: string;
    content: string; excerpt: string; thumbnail?: string; type: string;
  }>>(WP_PORTFOLIO_URL);

  const data: WpPortfolio[] = raw.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    content: stripHtml(p.content).slice(0, 1500),
    excerpt: stripHtml(p.excerpt).slice(0, 400),
    thumbnail: p.thumbnail,
  }));

  portfolioCache = { data, fetchedAt: Date.now() };
  return data;
}

// ─── Single post/page by ID ───────────────────────────────────────────────────

export async function getItemById(id: number): Promise<{
  id: number; title: string; url: string; content: string; excerpt: string; type: string;
}> {
  const raw = await wpFetch<{
    id: number; title: string; url: string;
    content: string; excerpt: string; type: string; thumbnail?: string;
  }>(`${BASE}/post/${id}`);

  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    content: stripHtml(raw.content).slice(0, 4000),
    excerpt: stripHtml(raw.excerpt).slice(0, 500),
    type: raw.type,
  };
}

// ─── Cache control ────────────────────────────────────────────────────────────

export function bustCache(): void {
  postsCache = null;
  pagesCache = null;
  portfolioCache = null;
}
