import Tesseract from 'tesseract.js';
import fs from 'fs';
import pngjs from 'pngjs';
const { PNG: PngImage } = pngjs;

const imagePath = 'C:\\Users\\thait\\Downloads\\xx.png';
const buffer = fs.readFileSync(imagePath);

const png = PngImage.sync.read(buffer);

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

const verticalLineColumns = [];
for (let x = 0; x < width; x++) {
  if (colDarkCounts[x] > height * 0.65) {
    verticalLineColumns.push(x);
  }
}

console.log('Detected vertical line columns:', verticalLineColumns);

for (let x of verticalLineColumns) {
  for (let y = 0; y < height; y++) {
    const idx = (width * y + x) << 2;
    png.data[idx] = 255;
    png.data[idx+1] = 255;
    png.data[idx+2] = 255;
  }
}

const outBuffer = PngImage.sync.write(png);
const outPath = 'C:\\Users\\thait\\Downloads\\xx_clean.png';
fs.writeFileSync(outPath, outBuffer);
console.log('Saved clean image to:', outPath);

console.log('Running OCR on clean image...');
const { data: { text } } = await Tesseract.recognize(outPath, 'eng');
console.log('=== OCR TEXT ===');
console.log(text);
console.log('=== END ===');

process.exit(0);
