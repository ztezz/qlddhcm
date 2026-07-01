const apiKey = 'AIzaSyBkQcVkq598V7nf32Q0L1osRW0SDVljmf8';

async function testEndpoint(url) {
  console.log(`\nTesting URL: ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: 'Hello' }] }
        ]
      })
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response (truncated):', text.slice(0, 300));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  // Test gemini-flash-latest
  await testEndpoint(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`);

  // Test gemini-2.0-flash
  await testEndpoint(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`);

  // Test gemini-2.5-flash-lite
  await testEndpoint(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`);

  process.exit(0);
}

main();
