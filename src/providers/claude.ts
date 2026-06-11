import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMTurnResult,
  NeutralMessage,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from '../types';

type AnthropicMessage = Anthropic.Messages.MessageParam;
type AnthropicContent = Anthropic.Messages.ContentBlock;
type AnthropicTool = Anthropic.Messages.Tool;

function toAnthropicMessages(messages: NeutralMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const content: Anthropic.Messages.ContentBlockParam[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.toolCalls ?? []) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }
      out.push({ role: 'assistant', content });
    } else if (msg.role === 'tool') {
      out.push({
        role: 'user',
        content: msg.results.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.callId,
          content: r.content,
          is_error: r.isError,
        })),
      });
    }
  }

  return out;
}

function toAnthropicTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
  }));
}

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async runTurn(
    messages: NeutralMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<LLMTurnResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: toAnthropicTools(tools),
    });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
    );
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
    );

    const content = textBlocks.map((b) => b.text).join('');
    const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
      id: b.id,
      name: b.name,
      input: b.input as Record<string, unknown>,
    }));

    const stopReason: LLMTurnResult['stopReason'] =
      response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn';

    return {
      message: { role: 'assistant', content, toolCalls: toolCalls.length ? toolCalls : undefined },
      stopReason,
    };
  }
}
