#!/usr/bin/env node
/** 把 Markdown 里的 /zh/ 站内链接改成指定 locale 前缀；代码 fence 内一并替换。 */
import { readFileSync, writeFileSync } from 'node:fs';

const [file, locale] = process.argv.slice(2);
if (!file || !locale) {
  console.error('Usage: node scripts/rewrite-locale-links.mjs <file.md> <ja|ru>');
  process.exit(1);
}
const text = readFileSync(file, 'utf8');
const out = text
  .replace(/(?<![A-Za-z0-9-])\/zh\//g, `/${locale}/`)
  .replace(/(?<![A-Za-z0-9-])\/zh-TW\//g, `/${locale}/`);
writeFileSync(file, out);
