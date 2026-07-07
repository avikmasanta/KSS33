async function test() {
  try {
    const url = 'https://kss33.onrender.com/api/outgoing';
    const payload = {
      siteId: '6a4affa46ff572b33b751cb0',
      date: '2026-07-06',
      referenceNo: 'TKT-TEST',
      notes: 'Testing post',
      items: [{
        materialId: 'id_1478201726084',
        quantity: 10
      }]
    };
    
    console.log('Sending payload to:', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Response Status:', res.status);
    const body = await res.json();
    console.log('Response Body:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
