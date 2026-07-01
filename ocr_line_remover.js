import Tesseract from 'tesseract.js';
import fs from 'fs';
import { PNG } from 'pngjs'; // Let's check if pngjs is available or we can write it using raw bytes

// Actually we don't have pngjs installed by default, let's install it or write a simple script using Jimp if available,
// or we can write a pure Node script that reads the PNG, parses it, removes vertical lines, and writes it back.
// Wait! Let's check if we can install pngjs first. It's tiny and has no dependencies.
import { execSync } from 'child_process';
console.log('Installing pngjs...');
execSync('npm install pngjs');

const pngjs = await import('pngjs');
const { PNG: PngImage } = pngjs;

const imagePath = 'C:\\Users\\thait\\Downloads\\2.png';
const buffer = fs.readFileSync(imagePath);

const png = PngImage.sync.read(buffer);

// Grayscale and count dark pixels per column
const width = png.width;
const height = png.height;
const colDarkCounts = new Array(width).fill(0);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) << 2;
    const r = png.data[idx];
    const g = png.data[idx+1];
    const b = png.data[idx+2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (gray < 180) {
      colDarkCounts[x]++;
    }
  }
}

// Erase columns that have > 65% dark pixels
const verticalLineColumns = [];
for (let x = 0; x < width; x++) {
  if (colDarkCounts[x] > height * 0.65) {
    verticalLineColumns.push(x);
  }
}

console.log('Detected vertical line columns:', verticalLineColumns);

// Erase them (paint white)
for (let x of verticalLineColumns) {
  for (let y = 0; y < height; y++) {
    const idx = (width * y + x) << 2;
    png.data[idx] = 255;
    png.data[idx+1] = 255;
    png.data[idx+2] = 255;
  }
}

// Write the modified image
const outBuffer = PngImage.sync.write(png);
const outPath = 'C:\\Users\\thait\\Downloads\\2_clean.png';
fs.writeFileSync(outPath, outBuffer);
console.log('Saved clean image to:', outPath);

// Run OCR on the clean image
console.log('Running OCR on clean image...');
const { data: { text } } = await Tesseract.recognize(outPath, 'eng');
console.log('=== OCR TEXT ===');
console.log(text);
console.log('=== END ===');

process.exit(0);
