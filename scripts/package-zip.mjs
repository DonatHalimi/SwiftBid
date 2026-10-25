import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(root, '..', 'ankand-marketplace.zip');
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'ankand-zip-'));
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '.git', '.next']);

function copyTree(source, target, relative = '') {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      if (rel.replaceAll('\\', '/') === 'backend/uploads') {
        const uploadTarget = path.join(target, entry.name);
        fs.mkdirSync(uploadTarget, { recursive: true });
        for (const child of fs.readdirSync(path.join(source, entry.name))) {
          if (child === '.gitkeep') fs.copyFileSync(path.join(source, entry.name, child), path.join(uploadTarget, child));
        }
        continue;
      }
      copyTree(path.join(source, entry.name), path.join(target, entry.name), rel);
      continue;
    }
    if (entry.name === '.env' || (entry.name.startsWith('.env.') && entry.name !== '.env.example')) continue;
    if (entry.name.endsWith('.log')) continue;
    fs.copyFileSync(path.join(source, entry.name), path.join(target, entry.name));
  }
}

try {
  copyTree(root, staging);
  fs.rmSync(destination, { force: true });
  if (process.platform === 'win32') {
    execFileSync('tar', ['-a', '-c', '-f', destination, '-C', staging, '.'], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-qr', destination, '.'], { cwd: staging, stdio: 'inherit' });
  }
  console.info(`ZIP created: ${destination}`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
