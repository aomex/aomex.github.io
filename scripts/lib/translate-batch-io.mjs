/**
 * 供人工 / Agent 批处理：导出待译正文片段，或写回译文后拼回 md。
 *
 * 导出：node --input-type=module -e "import('./scripts/lib/translate-batch-io.mjs').then(m=>m.exportBatch('ja', files))"
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasCjk,
  joinParts,
  rewriteAbsoluteLinks,
  splitMarkdownForTranslate,
} from './md-split.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DOCS = path.join(ROOT, 'docs');
const BATCH = path.join(ROOT, 'scripts', '.translate-batches');

const walkMd = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkMd(full));
    } else if (name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out.sort();
};

export const exportLocaleBatch = (localeId) => {
  const srcRoot = path.join(DOCS, localeId);
  const files = walkMd(srcRoot);
  const batchDir = path.join(BATCH, localeId);
  mkdirSync(batchDir, { recursive: true });

  const manifest = [];
  for (const full of files) {
    const rel = path.relative(srcRoot, full).split(path.sep).join('/');
    const text = readFileSync(full, 'utf8');
    const parts = splitMarkdownForTranslate(text);
    const segments = [];
    parts.forEach((part, index) => {
      if (part.kind !== 'text') {
        return;
      }
      if (!hasCjk(part.value) && !part.value.trim()) {
        return;
      }
      if (!hasCjk(part.value)) {
        return;
      }
      segments.push({ index, value: part.value });
    });
    const payload = { rel, parts, segments };
    const outFile = path.join(batchDir, rel.replaceAll('/', '__') + '.json');
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(payload, null, 2));
    manifest.push({ rel, outFile, segmentCount: segments.length });
  }
  writeFileSync(path.join(batchDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  return { batchDir, count: manifest.length };
};

/** 保留原文段首尾空白，避免译文 trim 后正文贴上 ``` 围栏 */
const preserveEdgeWhitespace = (original, translated) => {
  const lead = (original.match(/^\s*/) || [''])[0];
  const trail = (original.match(/\s*$/) || [''])[0];
  const core = translated.replace(/^\s+/, '').replace(/\s+$/, '');
  return `${lead}${core}${trail}`;
};

/** 把 segments[].value 的译文写回 parts，并落盘 docs/{locale}/ */
export const applyTranslatedFile = (localeId, jsonPath) => {
  const payload = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const { rel, parts, segments } = payload;
  for (const seg of segments) {
    if (typeof seg.value !== 'string') {
      throw new Error(`missing value for segment ${seg.index} in ${jsonPath}`);
    }
    if (!parts[seg.index] || parts[seg.index].kind !== 'text') {
      throw new Error(`bad segment index ${seg.index} in ${jsonPath}`);
    }
    const original = parts[seg.index].value;
    parts[seg.index].value = preserveEdgeWhitespace(original, seg.value);
  }
  let text = joinParts(parts);
  text = rewriteAbsoluteLinks(text, localeId);
  // 纠正仍指向 /zh/ 的链接
  text = text.replaceAll('](/zh/', `](/${localeId}/`);
  text = text.replaceAll('link: /zh/', `link: /${localeId}/`);
  const out = path.join(DOCS, localeId, rel);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, text);
  return out;
};

export const applyLocaleBatch = (localeId) => {
  const batchDir = path.join(BATCH, localeId);
  if (!existsSync(batchDir)) {
    throw new Error(`batch dir missing: ${batchDir}`);
  }
  const manifest = JSON.parse(readFileSync(path.join(batchDir, '_manifest.json'), 'utf8'));
  const applied = [];
  for (const item of manifest) {
    applyTranslatedFile(localeId, item.outFile);
    applied.push(item.rel);
  }
  return applied;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, localeId] = process.argv.slice(2);
  if (cmd === 'export' && localeId) {
    console.log(exportLocaleBatch(localeId));
  } else if (cmd === 'apply' && localeId) {
    console.log({ applied: applyLocaleBatch(localeId).length });
  } else {
    console.log('Usage: node scripts/lib/translate-batch-io.mjs export|apply <ja|ru>');
    process.exit(1);
  }
}
