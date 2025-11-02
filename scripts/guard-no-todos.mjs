#!/usr/bin/env node
/*
 Simple guard to fail CI when TODO/FIXME/HACK/XXX markers are present in source files.
 Ignores build artifacts, node_modules, Android compiled assets, and lockfiles.
*/
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', '.next', '.vercel', '.output',
  'android/app/src/main/assets/public', 'android/app/build', '.expo', '.turbo', '.cache'
]);
const IGNORED_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'pnpm-workspace.yaml'
]);
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml', '.css'
]);
const PATTERN = /(TODO|FIXME|HACK|XXX)\b/i;

/**
 * Return true if the path should be skipped (ignored dir/file or extension not in allowlist)
 */
function shouldSkip(filePath, stat) {
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.some((p) => IGNORED_DIRS.has(p))) return true;
  if (IGNORED_FILES.has(path.basename(filePath))) return true;
  if (stat.isDirectory()) return false;
  const ext = path.extname(filePath);
  if (!ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkip(fp, entry)) continue;
      yield* walk(fp);
    } else if (entry.isFile()) {
      if (shouldSkip(fp, entry)) continue;
      yield fp;
    }
  }
}

const roots = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'backend', 'src')
].filter((p) => fs.existsSync(p));

let found = [];
for (const r of roots) {
  for (const fp of walk(r)) {
    try {
      const text = fs.readFileSync(fp, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (PATTERN.test(line)) {
          found.push({ file: fp, line: idx + 1, content: line.trim() });
        }
      });
    } catch {}
  }
}

if (found.length) {
  console.error(`Found ${found.length} TODO-like markers:`);
  for (const f of found) {
    console.error(`- ${path.relative(ROOT, f.file)}:${f.line}  ${f.content}`);
  }
  console.error('\nPlease resolve or remove these before merging.');
  process.exit(2);
} else {
  console.log('No TODO/FIXME/HACK/XXX markers found.');
}
