import Tesseract from 'tesseract.js';

const imagePath = 'C:\\Users\\thait\\Downloads\\bang toa do.png';

async function runTest(lang, psm) {
  console.log(`\n--- Testing Lang: ${lang}, PSM: ${psm} ---`);
  try {
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      lang,
      {
        tessedit_pageseg_mode: psm,
      }
    );
    console.log('Text length:', text.length);
    console.log(text.trim());
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  // Test combinations
  await runTest('eng', '3'); // default
  await runTest('eng', '6'); // single uniform block
  await runTest('eng', '4'); // single column
  await runTest('vie', '6');
  process.exit(0);
}

main();
