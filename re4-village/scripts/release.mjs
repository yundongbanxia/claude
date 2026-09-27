// Copy the single-file build into release/ so it can be downloaded straight from GitHub.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
mkdirSync('release', { recursive: true });
copyFileSync('dist/index.html', 'release/RE4-Village.html');
const kb = Math.round(statSync('release/RE4-Village.html').size / 1024);
console.log(`release/RE4-Village.html (${kb} KB)`);
