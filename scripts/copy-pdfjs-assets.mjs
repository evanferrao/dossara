import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
const publicPdfjsPath = path.join(process.cwd(), 'public', 'pdfjs');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(publicPdfjsPath)) {
  fs.mkdirSync(publicPdfjsPath, { recursive: true });
}

// Copy worker
const workerSrc = path.join(pdfjsDistPath, 'build', 'pdf.worker.min.mjs');
const workerDest = path.join(publicPdfjsPath, 'pdf.worker.min.mjs');
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log(`Copied pdf.worker.min.mjs to public/pdfjs/`);
}

// Copy cmaps
const cmapsSrc = path.join(pdfjsDistPath, 'cmaps');
const cmapsDest = path.join(publicPdfjsPath, 'cmaps');
if (fs.existsSync(cmapsSrc)) {
  copyRecursiveSync(cmapsSrc, cmapsDest);
  console.log(`Copied cmaps/ to public/pdfjs/`);
}

// Copy standard_fonts
const fontsSrc = path.join(pdfjsDistPath, 'standard_fonts');
const fontsDest = path.join(publicPdfjsPath, 'standard_fonts');
if (fs.existsSync(fontsSrc)) {
  copyRecursiveSync(fontsSrc, fontsDest);
  console.log(`Copied standard_fonts/ to public/pdfjs/`);
}
