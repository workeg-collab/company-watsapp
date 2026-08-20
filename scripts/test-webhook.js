const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VERIFY_TOKEN = 'power_of_media_verify_token_2026';
const SAMPLE_PHONE_NUMBER_ID = '102938475610293';

console.log('====================================================');
console.log('  🧪 WhatsApp Multi-Tenant Webhook Test Suite       ');
console.log(`  Target: ${BASE_URL}`);
console.log('====================================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: GET Webhook Verification
  try {
    console.log('[Test 1] Testing Webhook GET Verification Challenge...');
    const challengeStr = 'test_challenge_code_12345';
    const res = await axios.get(`${BASE_URL}/api/webhook`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': challengeStr
      }
    });

    if (res.status === 200 && res.data.toString() === challengeStr) {
      console.log('  ✅ PASSED: Webhook verification challenge returned 200 with matching challenge.\n');
      passed++;
    } else {
      console.log(`  ❌ FAILED: Unexpected response ${res.status}: ${res.data}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // Test 2: Inbound Keyword Message ("خدماتنا")
  try {
    console.log('[Test 2] Testing Inbound Keyword Message ("خدماتنا")...');
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550234567',
                  phone_number_id: SAMPLE_PHONE_NUMBER_ID
                },
                contacts: [
                  {
                    profile: { name: 'أحمد علي' },
                    wa_id: '201012345678'
                  }
                ],
                messages: [
                  {
                    from: '201012345678',
                    id: `wamid_${Date.now()}`,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    text: { body: 'عايز اعرف خدماتنا المتاحة' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    const res = await axios.post(`${BASE_URL}/api/webhook`, payload);
    if (res.status === 200 && res.data === 'EVENT_RECEIVED') {
      console.log('  ✅ PASSED: Webhook returned HTTP 200 EVENT_RECEIVED immediately.\n');
      passed++;
    } else {
      console.log(`  ❌ FAILED: Unexpected status ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // Test 3: Inbound Greeting Message ("مرحبا")
  try {
    console.log('[Test 3] Testing Welcome Greeting ("مرحبا")...');
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550234567',
                  phone_number_id: SAMPLE_PHONE_NUMBER_ID
                },
                contacts: [
                  {
                    profile: { name: 'سارة محمد' },
                    wa_id: '201098765432'
                  }
                ],
                messages: [
                  {
                    from: '201098765432',
                    id: `wamid_${Date.now()}`,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    text: { body: 'السلام عليكم' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    const res = await axios.post(`${BASE_URL}/api/webhook`, payload);
    if (res.status === 200) {
      console.log('  ✅ PASSED: Welcome greeting processed successfully.\n');
      passed++;
    } else {
      console.log(`  ❌ FAILED: Unexpected status ${res.status}\n`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  // Test 4: Simulation API Endpoint
  try {
    console.log('[Test 4] Testing Internal Chat Simulator Endpoint (/api/simulate)...');
    const res = await axios.post(`${BASE_URL}/api/simulate`, {
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      message_text: 'اسعار الباقات',
      sender_phone: '201012345678',
      sender_name: 'محمد مصطفى'
    });

    if (res.data.success && res.data.data.evaluation.matched) {
      console.log(`  ✅ PASSED: Evaluated accurately -> Matched: "${res.data.data.evaluation.matchReason}"`);
      console.log(`  💬 Reply generated: "${res.data.data.evaluation.replyContent?.body?.substring(0, 45)}..."\n`);
      passed++;
    } else {
      console.log(`  ❌ FAILED: Simulation failed or did not match rule.\n`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    failed++;
  }

  console.log('====================================================');
  console.log(`  Summary: ${passed} Passed | ${failed} Failed`);
  console.log('====================================================');
}

runTests();
