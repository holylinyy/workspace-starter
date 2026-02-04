import { resolve } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export function updateReadmePlugin(packageDir) {
  return {
    name: 'update-readme',
    writeBundle(options, bundle) {
      const readmePath = resolve(packageDir, 'README.md');
      const pkgPath = resolve(packageDir, 'package.json');

      if (!existsSync(readmePath) || !existsSync(pkgPath)) return;

      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const version = pkg.version;

        let size = 0;
        Object.values(bundle).forEach((chunk) => {
          if (chunk.type === 'chunk') {
            size += gzipSync(Buffer.from(chunk.code)).length;
          }
        });
        const sizeStr = (size / 1024).toFixed(2) + 'kB';

        const versionBadge = `![version](https://img.shields.io/badge/Version-${version}-blue)`;
        const sizeBadge = `![minzipped size](https://img.shields.io/badge/minzipped%20size-${sizeStr}-success)`;

        let content = readFileSync(readmePath, 'utf-8');

        // Update Version
        const versionRegex = /!\[version\]\(https:\/\/img\.shields\.io\/badge\/Version-[^)]+\)/;
        if (versionRegex.test(content)) {
          content = content.replace(versionRegex, versionBadge);
        } else {
          const lines = content.split(/\r?\n/);
          const titleIndex = lines.findIndex((line) => line.startsWith('# '));
          if (titleIndex !== -1) {
            lines.splice(titleIndex + 1, 0, '\n' + versionBadge);
          } else {
            lines.unshift(versionBadge + '\n');
          }
          content = lines.join('\n');
        }

        // Update Size
        const sizeRegex =
          /!\[minzipped size\]\(https:\/\/img\.shields\.io\/badge\/minzipped%20size-[^)]+\)/;
        if (sizeRegex.test(content)) {
          content = content.replace(sizeRegex, sizeBadge);
        } else {
          // Check version badge position to append
          const vIndex = content.indexOf(versionBadge);
          if (vIndex !== -1) {
            content =
              content.slice(0, vIndex + versionBadge.length) +
              ' ' +
              sizeBadge +
              content.slice(vIndex + versionBadge.length);
          }
        }

        writeFileSync(readmePath, content);
      } catch (e) {
        console.error('Failed to update README badges:', e);
      }
    }
  };
}
