// Minimal helper to trigger the production test endpoint without shell quoting issues
// Usage: node scripts/send-onesignal-test.mjs "email-or-externalId"
const target = process.argv[2] || '';
if (!target) {
  console.error('Usage: node scripts/send-onesignal-test.mjs "email-or-externalId"');
  process.exit(1);
}

const endpoint = 'https://www.licitmasa.com.br/api/notifications/test';
const headers = { 'x-admin-token': 'DEV', 'Content-Type': 'application/json' };

async function run() {
  try {
    // 1) Try by externalId (email/uid)
    const byExternal = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ externalId: target, priority: 10 }),
    });
    const raw1 = await byExternal.text();
    console.log('By externalId response:', raw1);

    // 2) Fallback by email resolution if needed
    const byEmail = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: target, priority: 10 }),
    });
    const raw2 = await byEmail.text();
    console.log('By email resolution response:', raw2);
  } catch (e) {
    console.error('Error sending test:', e?.message || String(e));
    process.exit(2);
  }
}
run();
