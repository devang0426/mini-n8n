async function main() {
  const authUrl = 'https://rwbwrptitwkxuqgmbbpi.auth.ap-south-1.nhost.run/v1/signin/email-password';
  console.log('Testing connection to Nhost auth URL:', authUrl);

  try {
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'editor.a@acme.com',
        password: 'DemoPassword123!',
      }),
    });

    const status = res.status;
    const text = await res.text();
    console.log('Status:', status);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

main();
