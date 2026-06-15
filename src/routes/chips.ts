import { Router, type Request, type Response } from 'express';
import { getPosts, getPages, getPortfolio } from '../tools/cache';

const router = Router();

interface Chip {
  id: number;
  type: 'post' | 'portfolio' | 'page' | 'static';
  label: string;
  message: string;
  url?: string;
}

const DEFAULT_QUESTIONS: Chip[] = [
  { id: 0, type: 'static', label: 'Does my product need AI?', message: 'Does my product need AI?' },
  { id: 0, type: 'static', label: 'How do you approach enterprise UX?', message: 'How do you approach enterprise UX?' },
  { id: 0, type: 'static', label: 'What happens during discovery?', message: 'What happens during discovery?' },
  { id: 0, type: 'static', label: 'How much should an MVP cost?', message: 'How much should an MVP cost?' },
  { id: 0, type: 'static', label: 'We want to build an AI product', message: 'We want to build an AI product' },
  { id: 0, type: 'static', label: 'Can Kormoan help validate my idea?', message: 'Can Kormoan help validate my idea?' },
  { id: 0, type: 'static', label: 'How do you approach Design for AI?', message: 'How do you approach Design for AI?' },
];

const DEFAULT_EXPERTISE: Chip[] = [
  { id: 227487, type: 'page', label: 'DESIGN FOR AI', message: 'Tell me about Design for AI services at Kormoan' },
  { id: 0, type: 'static', label: 'PRODUCT DISCOVERY', message: 'What happens during your Product Discovery phase?' },
  { id: 0, type: 'static', label: 'ENTERPRISE UX', message: 'How does Kormoan approach Enterprise UX?' },
  { id: 0, type: 'static', label: 'SAAS PRODUCT DESIGN', message: 'What is your process for SaaS Product Design?' },
  { id: 0, type: 'static', label: 'PLATFORM ENGINEERING', message: 'Tell me about Kormoan\'s platform engineering capabilities' },
  { id: 0, type: 'static', label: 'DIGITAL TRANSFORMATION', message: 'How does Kormoan drive digital transformation?' },
  { id: 0, type: 'static', label: 'AI STRATEGY', message: 'What is Kormoan\'s AI strategy services?' },
  { id: 0, type: 'static', label: 'RESEARCH & VALIDATION', message: 'How do you conduct research and validation?' },
];

function formatPostToQuestion(title: string): string {
  let q = title.trim().replace(/[.?]$/, '');
  if (q.toLowerCase().startsWith('why ')) {
    if (!q.endsWith('?')) q += '?';
    return q;
  }
  if (q.toLowerCase().startsWith('how ')) {
    if (!q.endsWith('?')) q += '?';
    return q;
  }
  return `Tell me about: ${q}`;
}

function getShortLabel(title: string): string {
  let t = title.trim().replace(/\.$/, '');
  const lower = t.toLowerCase();
  if (lower.includes('indusind')) return 'INDUSIND BANK UX';
  if (lower.includes('rudraksh') || lower.includes('cultural landmark')) return 'RUDRAKSH LANDMARK';
  if (lower.includes('saarthi') || lower.includes('companion') || (lower.includes('wisdom') && !lower.includes('landmark'))) return 'SAARTHI AI COMPANION';
  if (lower.includes('akmy')) return 'AKMY POLYPLAST';
  
  if (t.length > 25) {
    return t.substring(0, 22).toUpperCase() + '...';
  }
  return t.toUpperCase();
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [posts, pages, portfolio] = await Promise.allSettled([
      getPosts(),
      getPages(),
      getPortfolio(),
    ]);

    const questions: Chip[] = [];
    const expertise: Chip[] = [];

    // 1. Populate Popular Questions from dynamic posts
    if (posts.status === 'fulfilled' && posts.value?.length) {
      // Pick top 4 posts and transform them to questions
      const dynamicQuestions = posts.value.slice(0, 4).map((post) => ({
        id: post.id,
        type: 'post' as const,
        label: formatPostToQuestion(post.title),
        message: formatPostToQuestion(post.title),
        url: post.url,
      }));
      questions.push(...dynamicQuestions);
    }
    
    // Fill the rest with default questions until we have at least 7 questions
    for (const q of DEFAULT_QUESTIONS) {
      if (questions.length >= 7) break;
      if (!questions.some((existing) => existing.label.toLowerCase() === q.label.toLowerCase())) {
        questions.push(q);
      }
    }

    // 2. Populate Explore Our Expertise from dynamic portfolio cases and key pages
    // Add "Design for AI" page first if it exists
    if (pages.status === 'fulfilled' && pages.value?.length) {
      const designForAiPage = pages.value.find(p => p.title.toLowerCase().includes('design for ai'));
      if (designForAiPage) {
        expertise.push({
          id: designForAiPage.id,
          type: 'page',
          label: 'DESIGN FOR AI',
          message: 'Tell me about Kormoan\'s Design for AI services.',
          url: designForAiPage.url,
        });
      }
    }

    // Add dynamic portfolio items as expertise chips
    if (portfolio.status === 'fulfilled' && portfolio.value?.length) {
      const portfolioChips = portfolio.value.slice(0, 4).map((item) => ({
        id: item.id,
        type: 'portfolio' as const,
        label: getShortLabel(item.title),
        message: `Tell me about the project: "${item.title}".`,
        url: item.url,
      }));
      expertise.push(...portfolioChips);
    }

    // Add "About Kormoan" page if it exists
    if (pages.status === 'fulfilled' && pages.value?.length) {
      const aboutPage = pages.value.find(p => p.title.toLowerCase().includes('about'));
      if (aboutPage) {
        expertise.push({
          id: aboutPage.id,
          type: 'page',
          label: 'ABOUT KORMOAN',
          message: 'Can you tell me about Kormoan?',
          url: aboutPage.url,
        });
      }
    }

    // Fill up to 8 expertise chips using DEFAULT_EXPERTISE list
    for (const exp of DEFAULT_EXPERTISE) {
      if (expertise.length >= 8) break;
      if (!expertise.some((existing) => existing.label.toLowerCase() === exp.label.toLowerCase())) {
        expertise.push(exp);
      }
    }

    res.json({ questions, expertise });
  } catch (err) {
    console.error('[chips route] Error generating dynamic chips:', err);
    // If anything fails, return the static defaults
    res.json({
      questions: DEFAULT_QUESTIONS,
      expertise: DEFAULT_EXPERTISE,
    });
  }
});

export default router;
