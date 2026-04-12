#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.resolve(process.cwd(), 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`index.html not found at ${indexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');

const checks = [
  {
    pattern: /<link[^>]+rel=["']modulepreload["'][^>]+href=["'][^"']*\/src\/[^"']+\.(?:ts|tsx)(?:\?[^"']*)?["'][^>]*>/gi,
    message: 'Remove modulepreload entries that point to /src/*.ts or /src/*.tsx.',
  },
  {
    pattern: /<link[^>]+rel=["']modulepreload["'][^>]+href=["'][^"']+\.(?:ts|tsx)(?:\?[^"']*)?["'][^>]*>/gi,
    message: 'Do not modulepreload TypeScript files; only built JS chunks should be preloaded.',
  },
  {
    pattern: /href=["']data:video\/mp2t[^"']*["']/gi,
    message: 'Found data:video/mp2t preload artifact. Remove manual modulepreload tags from index.html.',
  },
];

const findings = [];
for (const check of checks) {
  const matches = html.match(check.pattern);
  if (matches && matches.length) {
    findings.push({ message: check.message, samples: matches.slice(0, 3) });
  }
}

if (findings.length) {
  console.error('index.html validation failed.');
  for (const finding of findings) {
    console.error(`- ${finding.message}`);
    for (const sample of finding.samples) {
      console.error(`  sample: ${sample}`);
    }
  }
  process.exit(1);
}

console.log('index.html validation passed.');
