import Tesseract from 'tesseract.js';

const imagePath = 'C:\\Users\\thait\\Downloads\\2.png';

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
    console.log('=== TEXT ===');
    console.log(text);
    console.log('=== END ===');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  await runTest('eng', '3'); // default
  await runTest('eng', '6'); // assume single uniform block
  await runTest('eng', '4'); // single column
  process.exit(0);
}

main();
