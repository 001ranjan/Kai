import { Router, type Request, type Response } from 'express';
import { runAgent } from '../agent';

const router = Router();

interface ChatBody {
  sessionId?: string;
  message?: string;
  pageUrl?: string;
}

router.post('/', async (req: Request<{}, {}, ChatBody>, res: Response) => {
  const { sessionId, message, pageUrl } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  if (message.trim().length > 1000) {
    res.status(400).json({ error: 'message too long (max 1000 chars)' });
    return;
  }

  try {
    const response = await runAgent({
      sessionId: sessionId.trim(),
      userMessage: message.trim(),
      pageUrl: typeof pageUrl === 'string' ? pageUrl : '',
    });

    res.json({ response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[chat route] Error:', msg);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
