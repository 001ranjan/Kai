import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
  type Part,
} from '@google/generative-ai';
import type {
  LLMProvider,
  LLMTurnResult,
  NeutralMessage,
  ToolCall,
  ToolDefinition,
  ToolParameterProperty,
} from '../types';

function toGeminiType(type: string): SchemaType {
  switch (type) {
    case 'string':  return SchemaType.STRING;
    case 'number':  return SchemaType.NUMBER;
    case 'boolean': return SchemaType.BOOLEAN;
    case 'array':   return SchemaType.ARRAY;
    default:        return SchemaType.STRING;
  }
}

function toGeminiTools(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(
          ([key, prop]: [string, ToolParameterProperty]) => [
            key,
            {
              type: toGeminiType(prop.type),
              description: prop.description,
              ...(prop.enum ? { enum: prop.enum } : {}),
            },
          ]
        )
      ),
      required: t.parameters.required ?? [],
    },
  }));
}

// Converts neutral messages to Gemini Content[].
// Uses generateContent (stateless) so functionResponse parts ARE valid in role:'user'.
// startChat history rejects functionResponse — that's why we don't use startChat.
function toGeminiContents(messages: NeutralMessage[]): Content[] {
  const out: Content[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', parts: [{ text: msg.content }] });

    } else if (msg.role === 'assistant') {
      const parts: Part[] = [];
      for (const tc of msg.toolCalls ?? []) {
        parts.push({ functionCall: { name: tc.name, args: tc.input } });
      }
      if (msg.content) parts.push({ text: msg.content });
      if (parts.length) out.push({ role: 'model', parts });

    } else if (msg.role === 'tool') {
      // role:'user' with functionResponse parts is valid in generateContent
      out.push({
        role: 'user',
        parts: msg.results.map((r) => ({
          functionResponse: {
            name: r.toolName,
            response: { result: r.content, isError: r.isError },
          },
        })),
      });
    }
  }

  return out;
}

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async runTurn(
    messages: NeutralMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<LLMTurnResult> {
    const genModel = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toGeminiTools(tools) }],
    });

    // generateContent is stateless — pass full history every turn.
    // This avoids startChat's restriction on functionResponse in history.
    const result = await genModel.generateContent({
      contents: toGeminiContents(messages),
    });

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];

    const textContent = parts
      .filter((p): p is { text: string } => 'text' in p && typeof (p as { text?: string }).text === 'string')
      .map((p) => (p as { text: string }).text)
      .join('');

    type FunctionCallPart = { functionCall: { name: string; args: Record<string, unknown> } };
    const toolCalls: ToolCall[] = parts
      .filter((p): p is FunctionCallPart => 'functionCall' in p && p.functionCall !== undefined)
      .map((p, i) => ({
        id: `gemini_call_${Date.now()}_${i}`,
        name: p.functionCall.name,
        input: p.functionCall.args,
      }));

    const stopReason: LLMTurnResult['stopReason'] = toolCalls.length ? 'tool_use' : 'end_turn';

    return {
      message: {
        role: 'assistant',
        content: textContent,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      },
      stopReason,
    };
  }
}
