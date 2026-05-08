---
name: flowchart-generator
description: 将自然语言描述的业务流程自动转换为 draw.io 可渲染的 mxGraphModel XML 流程图。支持流式 LLM 生成、三级重试降级、XML 截断修复、画布自适应、领域术语定制。本技能不内置 LLM，完全依赖外部注入。适用于任何需要动态生成业务流程图的场景。
license: MIT
---

# 流程图生成技能 (Flowchart Generator Skill)

将自然语言描述的业务流程自动转换为 draw.io 可渲染的 mxGraphModel XML 流程图。

## 核心能力

- **自然语言转流程图**：输入中文业务描述，输出标准 mxGraphModel XML
- **流式生成**：突破输出 token 上限，支持复杂长流程
- **三级重试降级**：主模型流式 → 降级模型流式 → 精简提示词重试
- **XML 智能修复**：截断检测、画布自适应、标签闭合修复
- **领域术语定制**：内置金蝶云星辰标准单据术语，支持自定义领域词汇
- **零 LLM 依赖**：不内置任何 LLM 客户端，由宿主环境注入

## 使用场景

- 交付实施中的业务流程梳理
- 客户培训材料中的流程图自动生成
- 根据对话内容实时生成流程图
- 将文档描述转换为可视化流程

## 技术依赖

- Node.js 20+
- 宿主环境需提供符合 `LLMProvider` 接口的 LLM 实例

## LLM 注入方式

本技能**不内置 LLM 客户端**，所有 LLM 调用均通过外部注入。宿主环境（如 WorkBuddy）需提供一个符合 `LLMProvider` 接口的对象：

```typescript
interface LLMProvider {
  stream(
    messages: Message[],
    config?: { model?: string; temperature?: number }
  ): AsyncIterable<{ content?: string | Buffer }>;

  invoke(
    messages: Message[],
    config?: { model?: string; temperature?: number }
  ): Promise<{ content?: string }>;
}
```

### WorkBuddy 集成示例

```typescript
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { generateFlowchart, generateFlowchartWithDomain } from './flowchart-skill';

// WorkBuddy 创建 LLM 客户端
const config = new Config();
const llm = new LLMClient(config);

// 通用流程图生成
const result = await generateFlowchart({
  prompt: '采购申请单 -> 采购订单 -> 采购入库单 -> 付款单',
  direction: 'vertical',
  llm, // 注入 LLM 实例
});

if (result.success) {
  console.log(result.xml);
}

// 带领域术语的流程图（如金蝶云星辰）
const result2 = await generateFlowchartWithDomain({
  prompt: '客户签约后实施交付的完整流程',
  direction: 'vertical',
  domainName: '金蝶云星辰实施交付',
  domainTerms: ['销售订单', '发货通知单', '销售出库单'],
  llm, // 注入 LLM 实例
});
```

## 文件结构

```
flowchart-skill/
├── SKILL.md              # 本文件
├── src/
│   ├── index.ts          # 主要导出函数（generateFlowchart / generateFlowchartWithDomain）
│   ├── llm.ts            # LLMProvider 接口定义 + 重试逻辑
│   ├── prompts.ts        # 系统提示词模板
│   └── xml-processor.ts  # XML 后处理工具
```

## 函数说明

### `generateFlowchart(options)`

通用流程图生成函数。

**参数：**
- `prompt` (string, 必填): 流程描述文本
- `direction` ('vertical' | 'horizontal', 可选): 布局方向，默认 'vertical'
- `llm` (LLMProvider, 必填): 外部注入的 LLM 实例
- `model` (string, 可选): 模型 ID，默认 'doubao-seed-2-0-pro-260215'
- `temperature` (number, 可选): 温度参数

**返回：** `Promise<FlowchartResult>`
- `success` (boolean): 是否成功
- `xml` (string): mxGraphModel XML 字符串（成功时）
- `error` (string): 错误信息（失败时）

### `generateFlowchartWithDomain(options)`

领域定制流程图生成，支持注入业务术语。

**参数：**
- `prompt` (string, 必填): 流程描述文本
- `direction` ('vertical' | 'horizontal', 可选): 布局方向
- `domainName` (string, 必填): 领域名称
- `domainTerms` (string[], 可选): 领域术语列表
- `extraPrompt` (string, 可选): 额外提示词
- `llm` (LLMProvider, 必填): 外部注入的 LLM 实例
- `model` (string, 可选): 模型 ID
- `temperature` (number, 可选): 温度参数

**返回：** `Promise<FlowchartResult>`

## 高级用法

### 直接使用子模块

```typescript
import { buildSystemPrompt, validateAndCleanXml } from './flowchart-skill';

// 自定义构建提示词
const systemPrompt = buildSystemPrompt('金蝶云星辰', ['销售订单', '收款单']);

// 手动调用 LLM 后处理 XML
const rawXml = await myLLM.invoke(messages);
const cleanXml = validateAndCleanXml(rawXml.content);
```

### 自定义 LLMProvider

如果宿主环境的 LLM 接口与本技能不完全匹配，可封装一个适配器：

```typescript
const adapter: LLMProvider = {
  async *stream(messages, config) {
    const stream = myCustomLLM.chat(messages, config);
    for await (const chunk of stream) {
      yield { content: chunk.text };
    }
  },
  async invoke(messages, config) {
    const result = await myCustomLLM.complete(messages, config);
    return { content: result.text };
  },
};

const result = await generateFlowchart({ prompt: '...', llm: adapter });
```

## 渲染流程图

生成的 XML 可直接用于 draw.io / diagrams.net：

```typescript
// 创建 Blob 并打开 draw.io
const blob = new Blob([result.xml], { type: 'application/xml' });
const url = URL.createObjectURL(blob);
window.open(`https://embed.diagrams.net/?embed=1&proto=json&create=https://app.diagrams.net/&open=${encodeURIComponent(url)}`);
```
