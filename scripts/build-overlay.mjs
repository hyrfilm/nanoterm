#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { glob } from 'tinyglobby';

const DEFAULT_OUT = 'src/generated/fs-overlay.json';
const DEFAULT_EXCLUDE = ['**/.*', '**/__pycache__/**', '**/*.pyc', '**/*.pyo', '**/node_modules/**'];

const STRIKE = '\x1b[9m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function formatBytes(n) {
  return n.toLocaleString('en-US') + ' bytes';
}

function printHelp() {
  console.log(`Usage:
  node scripts/build-overlay.mjs --fromDir <directory> [--out <file>] [--exclude <glob> ...]

Options:
  --fromDir   Source directory to serialize into overlay JSON (required)
  --out       Output file path (default: ${DEFAULT_OUT})
  --exclude   Glob pattern to exclude (can be repeated, default: ${DEFAULT_EXCLUDE.join(', ')})
  --no-minify Write pretty-printed JSON instead of minified (default: minified)
  --help      Show this help

Example:
  node scripts/build-overlay.mjs --fromDir ./overlay --out ./src/generated/fs-overlay.json --exclude "**/*.tmp"
`);
}

function parseArgs(argv) {
  const args = {
    fromDir: '',
    out: DEFAULT_OUT,
    exclude: [...DEFAULT_EXCLUDE],
    minify: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--fromDir') {
      args.fromDir = argv[index += 1];
      continue;
    }
    if (token === '--out') {
      args.out = argv[index += 1];
      continue;
    }
    if (token === '--exclude') {
      args.exclude.push(argv[index += 1]);
      continue;
    }
    if (token === '--no-minify') {
      args.minify = false;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function setPath(tree, parts, value) {
  let current = tree;
  for (const part of parts.slice(0, -1)) {
    current[part] ??= {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function normalizeParts(relativePath) {
  return relativePath.split(path.sep).filter(Boolean);
}

function decodeUtf8(buffer) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

async function buildOverlay({ fromDir, exclude }) {
  const sourceDir = path.resolve(fromDir);
  const stat = await fs.stat(sourceDir);
  if (!stat.isDirectory()) throw new Error(`not a directory: ${fromDir}`);

  const allFiles = await glob('**/*', { cwd: sourceDir, onlyFiles: true, dot: true });
  const includedFiles = await glob('**/*', { cwd: sourceDir, onlyFiles: true, dot: true, ignore: exclude });

  allFiles.sort((a, b) => a.localeCompare(b));
  const includedSet = new Set(includedFiles);

  const root = {};
  const types = {};
  const fileStats = { text: 0, base64: 0, totalBytes: 0, excluded: 0 };

  for (const relativePath of allFiles) {
    if (!includedSet.has(relativePath)) {
      console.log(`  ${STRIKE}${relativePath}${RESET}`);
      fileStats.excluded += 1;
      continue;
    }

    const absolutePath = path.join(sourceDir, relativePath);
    const parts = normalizeParts(relativePath);
    const content = await fs.readFile(absolutePath);
    fileStats.totalBytes += content.length;

    const maybeText = decodeUtf8(content);
    if (maybeText !== null) {
      setPath(root, parts, maybeText);
      fileStats.text += 1;
    } else {
      setPath(root, parts, content.toString('base64'));
      setPath(types, parts, 'base64');
      fileStats.base64 += 1;
    }

    console.log(`  ${relativePath}  ${DIM}${formatBytes(content.length)}${RESET}`);
  }

  const overlay = { '/': root };
  if (Object.keys(types).length > 0) {
    overlay._ = { types: { '/': types } };
  }

  return { overlay, fileStats, totalIncluded: includedSet.size };
}

export async function runOverlayBuild({ fromDir, out = DEFAULT_OUT, exclude = DEFAULT_EXCLUDE, minify = true } = {}) {
  const { overlay, fileStats, totalIncluded } = await buildOverlay({ fromDir, exclude });

  const outPath = path.resolve(out);
  const json = minify ? JSON.stringify(overlay) : JSON.stringify(overlay, null, 2);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${json}\n`, 'utf8');

  console.log('');
  console.log(`${totalIncluded} files  ${formatBytes(fileStats.totalBytes)}  (${fileStats.excluded} excluded)`);
  console.log(`Written: ${outPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.fromDir) throw new Error('Missing required argument: --fromDir');

  await runOverlayBuild(args);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`overlay build failed: ${error.message}`);
    process.exitCode = 1;
  });
}
