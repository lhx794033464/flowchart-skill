/**
 * LLM 调用封装
 * 接受外部注入的 LLMClient，不直接依赖 SDK
 */

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface LLMConfig {
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseURL?: string;
}

export interface LLMClientLike {
  stream: (messages: Message[], config: LLMConfig) => AsyncIterable<{ text: string }>;
  invoke: (messages: Message[], config: LLMConfig) => Promise<{ text: string }>;
}

export function createLLMClient(config?: LLMConfig): LLMClientLike {
  const apiKey = config?.apiKey || process.env.COZE_API_TOKEN || '';
  const baseURL = config?.baseURL || process.env.COZE_INTEGRATION_MODEL_BASE_URL || '';
  const model = config?.model || 'doubao-seed-2-0-pro-260215';

  return {
    async *stream(messages: Message[], cfg: LLMConfig) {
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model || model,
          messages: messages as unknown as Record<string, unknown>[],
          stream: true,
          temperature: cfg.temperature ?? 0.01,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`LLM API error ${resp.status}: ${err}`);
      }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const chunk = JSON.parse(jsonStr);
            const text = chunk.choices?.[0]?.delta?.content || '';
            if (text) yield { text };
          } catch { /* ignore parse errors */ }
        }
      }
    },

    async invoke(messages: Message[], cfg: LLMConfig) {
      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model || model,
          messages: messages as unknown as Record<string, unknown>[],
          stream: false,
          temperature: cfg.temperature ?? 0.01,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`LLM API error ${resp.status}: ${err}`);
      }
      const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
      return { text: data.choices[0]?.message?.content || '' };
    },
  };
}

/** 主模型 + 降级模型 */
export const PRIMARY_MODEL = 'doubao-seed-2-0-pro-260215';
export const FALLBACK_MODEL = 'deepseek-v3-2-251201';

/** 调用 LLM，自动流式 + 截断重试 */
export async function callLLMWithRetry(
  client: LLMClientLike,
  messages: Message[],
  opts?: { model?: string; temperature?: number; maxRetries?: number }
): Promise<string> {
  const maxRetries = opts?.maxRetries ?? 2;
  let lastErr: Error | undefined;

  const attempts: { msgs: Message[]; model: string; mode: 'stream' | 'invoke' }[] = [
    { msgs: messages, model: opts?.model || PRIMARY_MODEL, mode: 'stream' },
    { msgs: messages, model: FALLBACK_MODEL, mode: 'stream' },
    { msgs: messages, model: opts?.model || PRIMARY_MODEL, mode: 'invoke' },
  ];

  for (let i = 0; i <= maxRetries && i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      if (attempt.mode === 'stream') {
        const stream = client.stream(attempt.msgs, { model: attempt.model, temperature: opts?.temperature });
        let full = '';
        for await (const chunk of stream) {
          full += chunk.text;
        }
        return full;
      } else {
        const result = await client.invoke(attempt.msgs, { model: attempt.model, temperature: opts?.temperature });
        return result.text;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr || new Error('LLM调用全部失败');
}

/** 简化入口：创建默认客户端并调用 */
export async function callLLM(
  messages: Message[],
  config?: LLMConfig
): Promise<string> {
  const client = createLLMClient(config);
  return callLLMWithRetry(client, messages);
}

/** 流式调用入口（供高级用户直接使用） */
export async function* callLLMStream(
  messages: Message[],
  config?: LLMConfig
): AsyncGenerator<string> {
  const client = createLLMClient(config);
  const cfg = { model: config?.model || PRIMARY_MODEL };
  for await (const chunk of client.stream(messages, cfg)) {
    yield chunk.text;
  }
}

/** 非流式调用入口（供高级用户直接使用） */
export async function callLLMInvoke(
  messages: Message[],
  config?: LLMConfig
): Promise<string> {
  const client = createLLMClient(config);
  const result = await client.invoke(messages, { model: config?.model || PRIMARY_MODEL });
  return result.text;
}
