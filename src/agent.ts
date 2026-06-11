import { SYSTEM_PROMPT } from './guardrails';
import { createProvider } from './providers/factory';
import { getOrCreateSession } from './sessions';
import { logConversation } from './sheets';
import { TOOL_DEFINITIONS, executeTool } from './tools';
import type { LLMProvider, NeutralMessage, ToolResult } from './types';

const MAX_TOOL_ITERATIONS = 5;

let provider: LLMProvider | null = null;

function getProvider(): LLMProvider {
  if (!provider) provider = createProvider();
  return provider;
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('Service Unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('529') ||
    msg.includes('529 ')
  );
}

async function runTurnWithRetry(
  ...args: Parameters<LLMProvider['runTurn']>
): ReturnType<LLMProvider['runTurn']> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await getProvider().runTurn(...args);
    } catch (err) {
      if (isRetryableError(err) && attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 2000; // 2s, 4s
        console.warn(`[agent] Transient API error, retrying in ${delay / 1000}s… (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

export async function runAgent(params: {
  sessionId: string;
  userMessage: string;
  pageUrl?: string;
}): Promise<string> {
  const { sessionId, userMessage, pageUrl = '' } = params;
  const session = getOrCreateSession(sessionId);

  session.messages.push({ role: 'user', content: userMessage });

  let finalResponse = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const result = await runTurnWithRetry(session.messages, TOOL_DEFINITIONS, SYSTEM_PROMPT);

    session.messages.push(result.message);

    if (result.stopReason === 'end_turn' || !result.message.toolCalls?.length) {
      finalResponse = result.message.content || 'Sorry, I could not generate a response.';
      break;
    }

    // Execute all tool calls in parallel
    const toolResults: ToolResult[] = await Promise.all(
      result.message.toolCalls.map(async (tc) => {
        try {
          const content = await executeTool(tc.name, tc.input);
          return { callId: tc.id, toolName: tc.name, content, isError: false };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[agent] Tool "${tc.name}" failed:`, msg);
          return { callId: tc.id, toolName: tc.name, content: `Tool error: ${msg}`, isError: true };
        }
      })
    );

    const toolMsg: NeutralMessage = { role: 'tool', results: toolResults };
    session.messages.push(toolMsg);
  }

  if (!finalResponse) {
    finalResponse = "I'm sorry, I wasn't able to complete that. Please try rephrasing your question.";
  }

  // Log to Google Sheets (non-blocking)
  logConversation({ sessionId, pageUrl, userMessage, agentResponse: finalResponse }).catch(() => {});

  return finalResponse;
}
