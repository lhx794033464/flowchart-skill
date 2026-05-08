/**
 * 流程图生成技能 - 核心入口
 *
 * 提供两个主要函数：
 * - generateFlowchart: 通用流程图生成
 * - generateFlowchartWithDomain: 领域定制流程图生成
 */

import { callLLM, type LLMConfig, type Message } from './llm.js';
import { buildSystemPrompt } from './prompts.js';
import { validateAndCleanXml, validateXmlStructure } from './xml-processor.js';

export interface FlowchartOptions {
  /** 流程描述文本 */
  prompt: string;
  /** 布局方向 */
  direction?: 'vertical' | 'horizontal';
  /** LLM 模型配置 */
  llmConfig?: LLMConfig;
}

export interface FlowchartWithDomainOptions extends FlowchartOptions {
  /** 领域名称（如：金蝶云星辰） */
  domainName: string;
  /** 领域术语列表 */
  domainTerms?: string[];
  /** 额外提示词 */
  extraPrompt?: string;
}

export interface FlowchartResult {
  /** 生成的 mxGraphModel XML */
  xml: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 通用流程图生成
 *
 * @example
 * ```ts
 * import { generateFlowchart } from './flowchart-skill';
 *
 * const result = await generateFlowchart({
 *   prompt: '采购申请单 -> 采购订单 -> 采购入库单 -> 付款单',
 *   direction: 'vertical'
 * });
 *
 * if (result.success) {
 *   console.log(result.xml); // <mxGraphModel>...</mxGraphModel>
 * }
 * ```
 */
export async function generateFlowchart(
  options: FlowchartOptions
): Promise<FlowchartResult> {
  const { prompt, direction = 'vertical', llmConfig } = options;

  const systemPrompt = buildSystemPrompt();
  const dirText = direction === 'horizontal' ? '水平' : '垂直';
  const userPrompt = `请生成一个${dirText}布局的流程图：${prompt}\n\n要求：\n1. 严格按上述步骤顺序排列\n2. 判断节点使用菱形\n3. 每个判断节点的出口标注条件（是/否、通过/不通过等）\n4. 输出完整的 <mxGraphModel> XML`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const result = await callLLM(messages, llmConfig);
    const xml = validateAndCleanXml(result);
    const validation = validateXmlStructure(xml);

    if (!validation.valid) {
      return { xml: '', success: false, error: validation.error };
    }

    return { xml, success: true };
  } catch (err) {
    return {
      xml: '',
      success: false,
      error: err instanceof Error ? err.message : '流程图生成失败',
    };
  }
}

/**
 * 领域定制流程图生成
 * 针对特定业务领域（如金蝶云星辰）优化术语和流程规范
 *
 * @example
 * ```ts
 * import { generateFlowchartWithDomain } from './flowchart-skill';
 *
 * const result = await generateFlowchartWithDomain({
 *   prompt: '销售订单 -> 发货通知 -> 销售出库单 -> 销售发票 -> 收款单',
 *   domainName: '金蝶云星辰',
 *   domainTerms: ['销售订单', '销售出库单', '收款单'],
 *   direction: 'vertical'
 * });
 * ```
 */
export async function generateFlowchartWithDomain(
  options: FlowchartWithDomainOptions
): Promise<FlowchartResult> {
  const { prompt, direction = 'vertical', domainName, domainTerms, extraPrompt, llmConfig } = options;

  const systemPrompt = buildSystemPrompt(domainName, domainTerms, extraPrompt);
  const dirText = direction === 'horizontal' ? '水平' : '垂直';
  const userPrompt = `请生成一个${dirText}布局的${domainName}业务流程图：${prompt}\n\n要求：\n1. 严格按上述步骤顺序排列\n2. 涉及标准单据名称时必须使用术语列表中的中文名称\n3. 判断节点使用菱形，出口标注条件\n4. 输出完整的 <mxGraphModel> XML`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const result = await callLLM(messages, llmConfig);
    const xml = validateAndCleanXml(result);
    const validation = validateXmlStructure(xml);

    if (!validation.valid) {
      return { xml: '', success: false, error: validation.error };
    }

    return { xml, success: true };
  } catch (err) {
    return {
      xml: '',
      success: false,
      error: err instanceof Error ? err.message : '流程图生成失败',
    };
  }
}

// 导出子模块供高级用户直接使用
export { callLLM, callLLMStream, callLLMInvoke, type LLMConfig, type Message } from './llm.js';
export { buildSystemPrompt, FLOWCHART_SYSTEM_PROMPT } from './prompts.js';
export { validateAndCleanXml, validateXmlStructure } from './xml-processor.js';
