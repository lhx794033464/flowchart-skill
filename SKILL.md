---
name: flowchart-generator
description: 将自然语言描述的业务流程自动转换为 draw.io 可渲染的 mxGraphModel XML 流程图。支持流式 LLM 生成、三级重试降级、XML 截断修复、画布自适应、领域术语定制。适用于任何需要动态生成业务流程图的场景。
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

## 使用场景

- 交付实施中的业务流程梳理
- 客户培训材料中的流程图自动生成
- 根据对话内容实时生成流程图
- 将文档描述转换为可视化流程

## 技术依赖

- `coze-coding-dev-sdk`（项目已内置）
- Node.js 20+

## 快速开始

```typescript
import { generateFlowchart, generateFlowchartWithDomain } from './flowchart-skill';

// 通用流程图生成
const xml = await generateFlowchart({
  prompt: '采购申请单 -> 采购订单 -> 采购入库单 -> 付款单',
  direction: 'vertical',
});

// 带领域术语的流程图（如金蝶云星辰）
const xml2 = await generateFlowchartWithDomain({
  prompt: '客户签约后实施交付的完整流程',
  direction: 'vertical',
  domainName: '金蝶云星辰实施交付',
  domainTerms: ['销售订单', '发货通知单', '销售出库单'],
});
```

## 文件结构

```
flowchart-skill/
├── SKILL.md              # 本文件
├── src/
│   ├── index.ts          # 主要导出函数
│   ├── llm.ts            # LLM 调用封装
│   ├── prompts.ts        # 系统提示词模板
│   └── xml-processor.ts  # XML 后处理工具
```

## 函数说明

### `generateFlowchart(options)`

通用流程图生成函数。

**参数：**
- `prompt` (string, 必填): 流程描述文本
- `direction` ('vertical' | 'horizontal', 可选): 布局方向，默认 'vertical'
- `model` (string, 可选): 模型 ID，默认 'doubao-seed-2-0-pro-260215'

**返回：** `Promise<string>` — mxGraphModel XML 字符串

### `generateFlowchartWithDomain(options)`

领域定制流程图生成，支持注入业务术语。

**参数：**
- `prompt` (string, 必填): 流程描述文本
- `direction` ('vertical' | 'horizontal', 可选): 布局方向
- `domainName` (string, 必填): 领域名称
- `domainTerms` (string[], 必填): 领域术语列表
- `extraPrompt` (string, 可选): 额外提示词
- `model` (string, 可选): 模型 ID

**返回：** `Promise<string>` — mxGraphModel XML 字符串

## 集成到项目

1. 将 `flowchart-skill/` 目录复制到目标项目的 `src/` 下
2. 按需引入函数使用
3. 确保项目已配置 `coze-coding-dev-sdk`（Coze 项目默认已内置）

## 渲染流程图

生成的 XML 可直接用于 draw.io / diagrams.net：

```typescript
// 创建 Blob 并打开 draw.io
const blob = new Blob([xml], { type: 'application/xml' });
const url = URL.createObjectURL(blob);
window.open(`https://embed.diagrams.net/?embed=1&proto=json&create=https://app.diagrams.net/&open=${encodeURIComponent(url)}`);
```
