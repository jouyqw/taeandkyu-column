import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const blogDir = 'blog';
const legacyPattern = /^(civil|criminal|divorce)-.*-2026-07-(0[1-9]|1[0-9]|2[0-2])\.html$/;
let changed = 0;

for (const file of readdirSync(blogDir).filter((name) => legacyPattern.test(name))) {
  const fullPath = join(blogDir, file);
  const html = readFileSync(fullPath, 'utf8');
  const next = html.replace(
    /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*>/i,
    '<meta name="robots" content="noindex, follow">'
  );

  if (next === html) continue;
  writeFileSync(fullPath, next, 'utf8');
  changed += 1;
}

console.log(`Marked ${changed} legacy auto-generated posts as noindex, follow`);
