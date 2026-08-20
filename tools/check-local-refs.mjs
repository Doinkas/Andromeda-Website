import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', '.agents', 'node_modules']);
const refPattern = /(?:href|src)=["']([^"']+)["']/g;

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

function isExternalRef(ref) {
  return /^(https?:|mailto:|tel:|#|data:)/i.test(ref);
}

const issues = [];
const htmlFiles = await listHtmlFiles(root);

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(refPattern)) {
    const rawRef = match[1];
    if (!rawRef || isExternalRef(rawRef)) continue;

    const cleanRef = rawRef.split('#')[0].split('?')[0];
    if (!cleanRef) continue;

    const target = cleanRef.startsWith('/')
      ? resolve(root, cleanRef.replace(/^\/+/, ''))
      : resolve(dirname(file), cleanRef);

    if (!existsSync(target)) {
      issues.push(`${relative(root, file)} -> ${rawRef}`);
    }
  }
}

if (issues.length) {
  console.error(issues.sort().join('\n'));
  process.exit(1);
}

console.log(`Checked local href/src refs in ${htmlFiles.length} HTML files.`);
