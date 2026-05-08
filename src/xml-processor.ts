/**
 * XML 后处理工具
 * 负责修复截断、清洗多余内容、自适应画布尺寸
 */

/** 验证并清洗 XML */
export function validateAndCleanXml(raw: string): string {
  let xml = raw.trim();

  // 去除 markdown 代码块
  xml = xml.replace(/```(?:xml)?\s*([\s\S]*?)```/g, '$1').trim();

  // 去除 XML 声明行
  xml = xml.replace(/^\s*<\?xml[^?]*\?>/, '').trim();

  // 查找 mxGraphModel 标签
  const startIdx = xml.indexOf('<mxGraphModel');
  if (startIdx === -1) {
    throw new Error('生成的内容缺少 mxGraphModel 标签');
  }

  // 提取从 <mxGraphModel 开始到末尾的内容
  xml = xml.slice(startIdx);

  // 检查是否被截断（有开头无结尾）
  const hasOpen = xml.includes('<mxGraphModel');
  const hasClose = xml.includes('</mxGraphModel>');

  if (hasOpen && !hasClose) {
    // 被截断，尝试修复
    const rootClose = xml.lastIndexOf('</root>');
    if (rootClose !== -1) {
      xml = xml.slice(0, rootClose + 7) + '</mxGraphModel>';
    } else {
      const lastCell = xml.lastIndexOf('</mxCell>');
      if (lastCell !== -1) {
        xml = xml.slice(0, lastCell + 9) + '</root></mxGraphModel>';
      } else {
        xml += '</root></mxGraphModel>';
      }
    }
  }

  // 自适应画布尺寸
  xml = adjustCanvasSize(xml);

  return xml;
}

/** 根据节点坐标动态调整画布尺寸 */
function adjustCanvasSize(xml: string): string {
  const cellRegex = /id="([^"]+)"[^>]*vertex="1"[^>]*>([\s\S]*?)<\/mxCell>/g;
  let maxX = 0;
  let maxY = 0;
  let match;

  while ((match = cellRegex.exec(xml)) !== null) {
    const inner = match[2];
    const xMatch = inner.match(/x="(\d+)"/);
    const yMatch = inner.match(/y="(\d+)"/);
    const wMatch = inner.match(/width="(\d+)"/);
    const hMatch = inner.match(/height="(\d+)"/);
    const x = xMatch ? parseInt(xMatch[1]) : 0;
    const y = yMatch ? parseInt(yMatch[1]) : 0;
    const w = wMatch ? parseInt(wMatch[1]) : 120;
    const h = hMatch ? parseInt(hMatch[1]) : 60;
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  const needHeight = maxY + 200;
  const needWidth = maxX + 200;

  // 只增大不缩小
  xml = xml.replace(/pageHeight="(\d+)"/, (_, old) => {
    const oldVal = parseInt(old);
    return `pageHeight="${Math.max(oldVal, needHeight)}"`;
  });
  xml = xml.replace(/pageWidth="(\d+)"/, (_, old) => {
    const oldVal = parseInt(old);
    return `pageWidth="${Math.max(oldVal, needWidth)}"`;
  });

  // 同步 dx/dy 偏移量
  xml = xml.replace(/dx="(\d+)"/, (_, old) => `dx="${Math.max(parseInt(old), needWidth)}"`);
  xml = xml.replace(/dy="(\d+)"/, (_, old) => `dy="${Math.max(parseInt(old), needHeight)}"`);

  return xml;
}

/** 验证 XML 结构完整性 */
export function validateXmlStructure(xml: string): { valid: boolean; error?: string } {
  if (!xml.includes('<mxGraphModel')) {
    return { valid: false, error: '缺少 <mxGraphModel> 根标签' };
  }
  if (!xml.includes('</mxGraphModel>')) {
    return { valid: false, error: '缺少 </mxGraphModel> 闭合标签（可能输出被截断）' };
  }

  const openRoot = (xml.match(/<root>/g) || []).length;
  const closeRoot = (xml.match(/<\/root>/g) || []).length;
  if (openRoot !== closeRoot) {
    return { valid: false, error: `<root> 标签不匹配: 开${openRoot} 闭${closeRoot}` };
  }

  return { valid: true };
}
