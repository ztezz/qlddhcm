const apiKey = 'AIzaSyBkQcVkq598V7nf32Q0L1osRW0SDVljmf8';

async function main() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    console.log('Status:', res.status, res.statusText);
    const json = await res.json();
    if (json.models) {
      console.log('Supported models:');
      json.models.forEach(m => {
        console.log(`- ${m.name} (Supported actions: ${m.supportedGenerationMethods.join(', ')})`);
      });
    } else {
      console.log('Response:', JSON.stringify(json, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

main();
