import fs from 'fs';

const filePath = 'C:\\Users\\thait\\Downloads\\bang toa do.png';
const buffer = fs.readFileSync(filePath);

console.log('File size:', buffer.length);
console.log('PNG Signature:', buffer.slice(0, 8).toString('hex'));

const ihdrIndex = buffer.indexOf(Buffer.from('IHDR'));
if (ihdrIndex !== -1) {
  const width = buffer.readUInt32BE(ihdrIndex + 4);
  const height = buffer.readUInt32BE(ihdrIndex + 8);
  const bitDepth = buffer[ihdrIndex + 12];
  const colorType = buffer[ihdrIndex + 13];
  
  console.log('Width:', width);
  console.log('Height:', height);
  console.log('Bit Depth:', bitDepth);
  console.log('Color Type:', colorType, colorType === 6 ? '(RGBA - Has Alpha)' : '(Other)');
} else {
  console.log('No IHDR chunk found!');
}
