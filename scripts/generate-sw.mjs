import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), 'out');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const urls = [];
walkDir(outDir, (filePath) => {
  const relativePath = path.relative(outDir, filePath).replace(/\\/g, '/');
  // Skip source maps, hidden files, and the service worker itself
  if (relativePath.endsWith('.map') || relativePath.startsWith('.') || relativePath === 'sw.js') {
    return;
  }
  urls.push('/' + relativePath);
});

// Map root index to '/'
const mappedUrls = urls.map(u => {
  if (u === '/index.html' || u === '/index.txt') return '/';
  if (u.endsWith('.html')) return u.replace(/\.html$/, '');
  return u;
});

// Deduplicate
const uniqueUrls = [...new Set(mappedUrls)];

const cacheKey = `dossara-cache-${Date.now()}`;
const swPath = path.join(outDir, 'sw.js');

if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');

  // Replace cache name and inject precache URLs
  swContent = swContent.replace(
    /const CACHE_NAME = 'dossara-cache-[^']+';/,
    `const CACHE_NAME = '${cacheKey}';\nconst PRECACHE_URLS = ${JSON.stringify(uniqueUrls)};`
  );

  // Update install event
  swContent = swContent.replace(
    /self\.addEventListener\('install', \(event\) => \{\s+self\.skipWaiting\(\);\s+\}\);/,
    `self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use allSettled to ensure failure of one file doesn't crash the entire SW installation
      return Promise.allSettled(
        PRECACHE_URLS.map(url => 
          cache.add(url).catch(err => console.warn('Failed to precache:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});`
  );

  fs.writeFileSync(swPath, swContent);
  console.log(`Successfully injected ${uniqueUrls.length} files into sw.js for precaching. Cache key: ${cacheKey}`);
} else {
  console.error("Could not find out/sw.js. Make sure next build generates it.");
}
