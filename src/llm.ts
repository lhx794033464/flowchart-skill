/**
 * LLM Provider 接口定义
 *
 * 本技能不内置任何 LLM 客户端，完全依赖外部注入。
 * WorkBuddy 或其他宿主环境需提供符合此接口的 LLM 实例。
 */

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * LLM Provider 接口
 *
 * 与 coze-coding-dev-sdk 的 LLMClient 兼容：
 * - stream() 返回的 chunk 应有 content 属性（string | Buffer）
 * - invoke() 返回的对象应有 content 属性（string）
 */
export interface LLMProvider {
  stream(
    messages: Message[],
    config?: { model?: string; temperature?: number; [key: string]: unknown }
  ): AsyncIterable<{ content?: unknown }>;

  invoke(
    messages: Message[],
    config?: { model?: string; temperature?: number; [key: string]: unknown }
  ): Promise<{ content?: unknown }>;
}

/** 主模型 + 降级模型（仅作为默认建议，实际由注入方控制） */
export const PRIMARY_MODEL = 'doubao-seed-2-0-pro-260215';
export const FALLBACK_MODEL = 'deepseek-v3-2-251201';

/** 辅助函数：从 chunk 中提取文本（兼容 string / Buffer / 其他） */
function extractText(chunk: { content?: unknown }): string {
  if (chunk.content == null) return '';
  if (typeof chunk.content === 'string') return chunk.content;
  // 兼容 Buffer、Uint8Array 等含 toString 的对象
  const maybe = chunk.content as { toString?: () => string };
  if (typeof maybe.toString === 'function') {
    return maybe.toString();
  }
  return String(chunk.content);
}

/** 辅助函数：从响应中提取文本 */
function extractResponseText(result: { content?: unknown }): string {
  return extractText(result);
}

/**
 * 调用 LLM，自动流式 + 截断重试
 *
 * @param llm - 外部注入的 LLMProvider 实例（必需）
 * @param messages - 消息列表
 * @param opts - 可选配置（模型、温度、最大重试次数）
 */
export async function callLLMWithRetry(
  llm: LLMProvider,
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
        const stream = llm.stream(attempt.msgs, { model: attempt.model, temperature: opts?.temperature });
        let full = '';
        for await (const chunk of stream) {
          full += extractText(chunk);
        }
        return full;
      } else {
        const result = await llm.invoke(attempt.msgs, { model: attempt.model, temperature: opts?.temperature });
        return extractResponseText(result);
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr || new Error('LLM调用全部失败');
}
