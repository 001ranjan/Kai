import OpenAI from 'openai';
import type {
  LLMProvider,
  LLMTurnResult,
  NeutralMessage,
  ToolCall,
  ToolDefinition,
} from '../types';

type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam;
type OAITool = OpenAI.Chat.ChatCompletionTool;

function toOAIMessages(messages: NeutralMessage[]): OAIMessage[] {
  const out: OAIMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const toolCalls = msg.toolCalls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      }));
      out.push({
        role: 'assistant',
        content: msg.content || null,
        ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
      });
    } else if (msg.role === 'tool') {
      for (const r of msg.results) {
        out.push({
          role: 'tool',
          tool_call_id: r.callId,
          content: r.content,
        });
      }
    }
  }

  return out;
}

function toOAITools(tools: ToolDefinition[]): OAITool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async runTurn(
    messages: NeutralMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<LLMTurnResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...toOAIMessages(messages)],
      tools: toOAITools(tools),
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;

    const content = assistantMsg.content ?? '';
    const toolCalls: ToolCall[] =
      assistantMsg.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      })) ?? [];

    const stopReason: LLMTurnResult['stopReason'] =
      choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn';

    return {
      message: { role: 'assistant', content, toolCalls: toolCalls.length ? toolCalls : undefined },
      stopReason,
    };
  }
}
