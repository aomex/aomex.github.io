#!/usr/bin/env node
/**
 * 从简体 docs/zh/ 生成 ja / ru 文档（跳过代码 fence，保留 API 名）。
 *
 * 用法：
 *   pnpm translate ja
 *   pnpm translate ja ru
 *   pnpm translate ja --force
 *   pnpm translate ru --dry-run
 *   pnpm translate ja --concurrency=3
 *
 * 环境变量（OpenAI 兼容 Chat Completions）：
 *   TRANSLATE_API_KEY   或 OPENAI_API_KEY（必填）
 *   TRANSLATE_BASE_URL  默认 https://api.openai.com/v1
 *   TRANSLATE_MODEL     默认 gpt-4o-mini
 *
 * 产物：
 *   docs/ja|ru/ 下全部 .md
 *   scripts/generated/{id}-labels.json   侧栏 + UI 文案，便于贴进 config.mts
 *   scripts/.translate-cache/{id}/       按源文件 hash 缓存，免重复扣费
 */

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCALES,
  SOURCE_DOCS_DIR,
  UI_STRINGS_ZH,
  ZH_SIDEBAR_LABELS,
} from './lib/locales.mjs';
import {
  hasCjk,
  joinParts,
  rewriteAbsoluteLinks,
  splitMarkdownForTranslate,
} from './lib/md-split.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const CACHE_ROOT = path.join(ROOT, 'scripts', '.translate-cache');
const GENERATED = path.join(ROOT, 'scripts', 'generated');

const apiKey = process.env.TRANSLATE_API_KEY || process.env.OPENAI_API_KEY || '';
const baseUrl = (process.env.TRANSLATE_BASE_URL || 'https://api.openai.com/v1').replace(
  /\/$/,
  '',
);
const model = process.env.TRANSLATE_MODEL || 'gpt-4o-mini';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const localeIds = args.filter((a) => !a.startsWith('--'));
const force = flags.has('--force');
const dryRun = flags.has('--dry-run');
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const concurrency = Math.max(
  1,
  Number(concurrencyArg?.split('=')[1] || process.env.TRANSLATE_CONCURRENCY || 2),
);

const usage = () => {
  console.log(`用法: pnpm translate <ja|ru> [...] [--force] [--dry-run] [--concurrency=N]

环境变量: TRANSLATE_API_KEY / OPENAI_API_KEY, TRANSLATE_BASE_URL, TRANSLATE_MODEL`);
};

if (flags.has('--help') || flags.has('-h')) {
  usage();
  process.exit(0);
}
if (localeIds.length === 0) {
  usage();
  process.exit(1);
}

for (const id of localeIds) {
  if (!LOCALES[id]) {
    console.error(`未知 locale: ${id}（支持: ${Object.keys(LOCALES).join(', ')}）`);
    process.exit(1);
  }
}

if (!apiKey && !dryRun) {
  console.error('缺少 TRANSLATE_API_KEY 或 OPENAI_API_KEY');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const walkMd = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walkMd(p, out);
    } else if (name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
};

const ensureDir = (dir) => {
  mkdirSync(dir, { recursive: true });
};

const hashText = (text) => {
  return createHash('sha256').update(text).digest('hex').slice(0, 24);
};

const cachePath = (localeId, sourceRel, sourceHash) => {
  const safe = sourceRel.replaceAll(path.sep, '__');
  return path.join(CACHE_ROOT, localeId, `${safe}.${sourceHash}.md`);
};

const chatTranslate = async (system, user) => {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('API 返回空内容');
  }
  return content.trim();
};

const systemForLocale = (locale) => {
  return `You are a technical writer translating aomex (Node.js / TypeScript framework) documentation from Simplified Chinese into ${locale.englishName} (${locale.lang}).

Rules:
- Output ONLY the translation, no preamble.
- Keep Markdown structure (headings, lists, tables, ::: tip / ::: warning).
- Do NOT translate code identifiers, package names, API names, file paths, env vars, or content inside backticks that is code.
- Keep VitePress markers like [!code highlight] / [!code focus:N] if they appear in prose (they usually stay in code fences which you will not see).
- Tone: peer engineer docs, address the reader as appropriate for ${locale.englishName} technical writing; clear and concise.
- Preserve link URLs exactly as given (including /${locale.dir}/ prefixes).`;
};

const translateProse = async (locale, text) => {
  if (!text.trim() || !hasCjk(text)) {
    return text;
  }
  if (dryRun) {
    return text;
  }
  return chatTranslate(systemForLocale(locale), text);
};

const translateMarkdownFile = async (locale, sourceText) => {
  const parts = splitMarkdownForTranslate(sourceText);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].kind !== 'text') {
      continue;
    }
    if (!hasCjk(parts[i].value)) {
      continue;
    }
    // 过大块切片，避免超长上下文
    const chunk = parts[i].value;
    if (chunk.length > 6000) {
      const paras = chunk.split(/\n\n+/);
      const buf = [];
      let acc = '';
      for (const para of paras) {
        if ((acc + '\n\n' + para).length > 5000 && acc) {
          buf.push(await translateProse(locale, acc));
          acc = para;
        } else {
          acc = acc ? `${acc}\n\n${para}` : para;
        }
      }
      if (acc) {
        buf.push(await translateProse(locale, acc));
      }
      parts[i].value = buf.join('\n\n');
    } else {
      parts[i].value = await translateProse(locale, chunk);
    }
  }
  return rewriteAbsoluteLinks(joinParts(parts), locale.dir);
};

const mapPool = async (items, limit, fn) => {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
};

const translateLabels = async (locale) => {
  const payload = {
    sidebar: ZH_SIDEBAR_LABELS,
    ui: UI_STRINGS_ZH,
  };
  const system = `Translate JSON string values from Simplified Chinese to ${locale.englishName}. Keep keys unchanged. Keep product names (Web, Console, Prisma, Mongoose, OpenAPI, Swagger, Redoc, ETag, CORS, schema, Auth, Bearer, API Key, JWT, SSE, Cron) as-is when they are proper nouns. Return ONLY valid JSON.`;
  if (dryRun) {
    return payload;
  }
  const raw = await chatTranslate(system, JSON.stringify(payload, null, 2));
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`${locale.id} labels: 无法解析 JSON`);
  }
  return JSON.parse(jsonMatch[0]);
};

const processLocale = async (localeId) => {
  const locale = LOCALES[localeId];
  const sourceRoot = path.join(DOCS, SOURCE_DOCS_DIR);
  const destRoot = path.join(DOCS, locale.dir);
  if (!existsSync(sourceRoot)) {
    throw new Error(`缺少简体源目录: docs/${SOURCE_DOCS_DIR}`);
  }
  const sources = walkMd(sourceRoot);
  console.log(
    `\n== ${locale.label} (${locale.id})  ${sources.length} 个 md ← docs/${SOURCE_DOCS_DIR}/ → docs/${locale.dir}/ ==`,
  );

  ensureDir(path.join(CACHE_ROOT, locale.id));
  ensureDir(destRoot);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  await mapPool(sources, concurrency, async (srcAbs) => {
    const rel = path.relative(sourceRoot, srcAbs);
    const destAbs = path.join(destRoot, rel);
    const sourceText = readFileSync(srcAbs, 'utf8');
    const h = hashText(sourceText + '\0' + model + '\0' + locale.lang);
    const cacheFile = cachePath(locale.id, rel, h);

    try {
      ensureDir(path.dirname(destAbs));
      if (!force && existsSync(cacheFile)) {
        copyFileSync(cacheFile, destAbs);
        skipped++;
        return;
      }
      if (!force && existsSync(destAbs)) {
        const existing = readFileSync(destAbs, 'utf8');
        // 目标已无 CJK 且非强制时跳过（可能手改过）
        if (!hasCjk(existing) && existing.includes(`/${locale.dir}/`)) {
          skipped++;
          return;
        }
      }

      process.stdout.write(`  [${locale.id}] ${rel} ... `);
      if (dryRun) {
        console.log('dry-run');
        done++;
        return;
      }
      const translated = await translateMarkdownFile(locale, sourceText);
      writeFileSync(destAbs, translated);
      ensureDir(path.dirname(cacheFile));
      writeFileSync(cacheFile, translated);
      console.log('ok');
      done++;
      await sleep(120);
    } catch (e) {
      failed++;
      console.log('FAIL');
      console.error(`    ${e instanceof Error ? e.message : e}`);
    }
  });

  console.log(`  完成 ${done}，缓存/跳过 ${skipped}，失败 ${failed}`);

  if (!dryRun) {
    process.stdout.write(`  [${locale.id}] sidebar/ui labels ... `);
    try {
      const labels = await translateLabels(locale);
      ensureDir(GENERATED);
      const out = path.join(GENERATED, `${locale.id}-labels.json`);
      writeFileSync(
        out,
        `${JSON.stringify(
          {
            locale: {
              id: locale.id,
              lang: locale.lang,
              label: locale.label,
              link: `/${locale.dir}/`,
            },
            ...labels,
          },
          null,
          2,
        )}\n`,
      );
      console.log(`→ ${path.relative(ROOT, out)}`);
    } catch (e) {
      console.log('FAIL');
      console.error(`    ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`
下一步（启用站点语言）：
  1. 把 scripts/generated/${locale.id}-labels.json 里的 sidebar/ui 接到 docs/.vitepress/config.mts locales
  2. 在 theme/autoLocale*.ts 增加 ${locale.id} 的浏览器语言匹配（如需要）
  3. pnpm build 检查死链与页面
`);
};

for (const id of localeIds) {
  await processLocale(id);
}
