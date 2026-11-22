/**
 * 把 Markdown 拆成「可译正文」与「原样保留」交替片段。
 * 奇数下标（1,3,5…）为 fence / 行内需保留块；偶数下标为可译文本。
 *
 * 保留：```...```、~~~...~~~、缩进代码块不单独处理（少见）。
 */
export const splitMarkdownForTranslate = (text) => {
  const parts = [];
  const re = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'code', value: m[0] });
    last = m.index + m[0].length;
  }
  parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
};

export const joinParts = (parts) => {
  return parts.map((p) => p.value).join('');
};

/** 绝对站内链接加上 locale 前缀；已有 en/zh-TW/ja/ru 或外链不改 */
export const rewriteAbsoluteLinks = (text, prefix) => {
  const exclude = 'zh/|zh-TW/|en/|ja/|ru/|https?:|mailto:|#';
  const linkRe = new RegExp(`(\\]\\()(/)(?!${exclude})`, 'g');
  const fmRe = new RegExp(`(link:\\s*)(/)(?!${exclude})`, 'g');
  return text.replace(linkRe, `$1/${prefix}/`).replace(fmRe, `$1/${prefix}/`);
};

export const hasCjk = (text) => {
  return /[\u4e00-\u9fff]/.test(text);
};
