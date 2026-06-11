// ─── Neutral message format (provider-agnostic) ──────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

export type NeutralMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] };

// ─── Tool definition (provider-agnostic) ─────────────────────────────────────

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface LLMTurnResult {
  message: Extract<NeutralMessage, { role: 'assistant' }>;
  stopReason: 'end_turn' | 'tool_use';
}

export interface LLMProvider {
  runTurn(
    messages: NeutralMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<LLMTurnResult>;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  messages: NeutralMessage[];
  createdAt: Date;
  lastActiveAt: Date;
}

// ─── WordPress content ────────────────────────────────────────────────────────

export interface WpPost {
  id: number;
  title: string;
  url: string;
  content: string;
  thumbnail?: string;
}

export interface WpPage {
  id: number;
  title: string;
  url: string;
  content: string;
}

export interface WpPortfolio {
  id: number;
  title: string;
  url: string;
  content: string;
  excerpt: string;
  thumbnail?: string;
}
