const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

/**
 * Generates the text report containing:
 * 1. Warehouse items with stock quantity > 0
 * 2. Active sites that have crossed 12 days since lintelDate (inclusive of lintel day itself, i.e., daysPassed > 12)
 */
async function generateDailyWarehouseSummaryText({ date, models }) {
  const Material   = models.Material;
  const Incoming   = models.Incoming;
  const Outgoing   = models.Outgoing;
  const SiteReturns = models.SiteReturns;
  const RentalSite = models.RentalSite;
  const Site       = models.Site;

  // 1. Fetch data
  const materials   = await Material.find({ status: { $ne: 'Archived' } });
  const sites       = await Site.find({ status: 'Active' });
  const allIncoming = await Incoming.find({});
  const allOutgoing = await Outgoing.find({});
  const allReturns  = await SiteReturns.find({});
  const allRentals  = await RentalSite.find({});

  // 2. Calculate current warehouse stock
  const currentStockMap = {};
  materials.forEach(m => {
    const mId = String(m._id || m.id);
    let purchased = 0, returned = 0, sent = 0, rented = 0;

    allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          const qty = parseFloat(i.quantity) || 0;
          if (r.supplier && r.supplier.toLowerCase().includes('return')) returned += qty;
          else purchased += qty;
        }
      });
    });
    allReturns.forEach(r => {
      if (String(r.materialId) === mId) returned += parseFloat(r.quantity) || 0;
    });
    allOutgoing.forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0;
      });
    });
    allRentals.filter(r => r.status === 'Active').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) rented += parseFloat(i.quantity) || 0;
      });
    });
    currentStockMap[mId] = (purchased + returned) - sent - rented;
  });

  // Filter materials with quantity > 0 and sort by name
  const warehouseRows = materials.map(m => {
    const mId = String(m._id || m.id);
    return { name: m.name, unit: m.unit || 'Nos', qty: currentStockMap[mId] || 0 };
  })
  .filter(r => r.qty > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

  // 3. Filter sites that have crossed 12 days since lintelDate
  const lintelAlertSites = [];
  sites.forEach(s => {
    if (s.lintelDate) {
      // Parse dates cleanly
      const [ly, lm, ld] = s.lintelDate.split('-').map(Number);
      const [ry, rm, rd] = date.split('-').map(Number);
      const lintelDateObj = new Date(ly, lm - 1, ld);
      const reportDateObj = new Date(ry, rm - 1, rd);

      // Strip time
      lintelDateObj.setHours(0,0,0,0);
      reportDateObj.setHours(0,0,0,0);

      const diffTime = reportDateObj.getTime() - lintelDateObj.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const daysCount = diffDays + 1; // counting lintel day as day 1

      if (daysCount > 12) {
        lintelAlertSites.push({
          name: s.name,
          customerName: s.customerName,
          lintelDate: s.lintelDate,
          daysPassed: daysCount
        });
      }
    }
  });

  // Sort sites by days passed descending
  lintelAlertSites.sort((a, b) => b.daysPassed - a.daysPassed);

  // 4. Format text message
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateFormatted = new Date(yr, mo - 1, dy).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let text = `📋 KSS Daily Warehouse & Site Lintel Report\n📅 Date: ${dateFormatted}\n\n`;
  
  text += `🏢 Warehouse Stock:\n`;
  if (warehouseRows.length === 0) {
    text += `- No stock in warehouse\n`;
  } else {
    warehouseRows.forEach(row => {
      text += `- ${row.name}: ${row.qty.toLocaleString('en-IN')} ${row.unit}\n`;
    });
  }

  text += `\n📍 Sites Crossed 12 Days (Lintel):\n`;
  if (lintelAlertSites.length === 0) {
    text += `- None\n`;
  } else {
    lintelAlertSites.forEach(s => {
      const custStr = s.customerName ? ` (${s.customerName})` : '';
      text += `- ${s.name}${custStr}: ${s.daysPassed} Days (since ${s.lintelDate})\n`;
    });
  }

  return text;
}

/**
 * Sends the SMS report to configured recipients
 */
/**
 * Splits a text into chunks of at most maxLen characters, trying to split at newlines.
 */
function splitMessageIntoChunks(text, maxLen = 110) {
  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = '';

  for (const line of lines) {
    if (line.length > maxLen) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      let remaining = line;
      while (remaining.length > maxLen) {
        chunks.push(remaining.substring(0, maxLen));
        remaining = remaining.substring(maxLen);
      }
      currentChunk = remaining;
    } else if (currentChunk.length + line.length + 1 > maxLen) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? (currentChunk + '\n' + line) : line;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  if (chunks.length > 1) {
    return chunks.map((chunk, idx) => `${chunk}\n[Part ${idx + 1}/${chunks.length}]`);
  }
  return chunks;
}

/**
 * Sends the SMS report to configured recipients
 */
async function sendSmsReport({ date, models }) {
  // 1. Fetch configured SMS contact numbers
  let contacts = [];
  try {
    const list = await models.SmsContact.find({});
    contacts = list.map(c => String(c._id || c.id).trim());
  } catch (err) {
    console.error('Error fetching SMS contacts from DB:', err);
  }

  // Fallback to environment variable recipients
  if (process.env.SMS_RECIPIENTS) {
    const envRecipients = process.env.SMS_RECIPIENTS.split(',').map(r => r.trim()).filter(Boolean);
    contacts = [...new Set([...contacts, ...envRecipients])];
  }

  if (contacts.length === 0) {
    return {
      success: false,
      message: 'No SMS recipients configured in DB or .env.'
    };
  }

  // 2. Generate report text
  let reportText;
  try {
    reportText = await generateDailyWarehouseSummaryText({ date, models });
  } catch (err) {
    console.error('Error generating report text:', err);
    throw new Error('Report text generation failed: ' + err.message);
  }

  // Split report text into chunks of <= 110 characters
  const chunks = splitMessageIntoChunks(reportText, 110);
  const results = [];

  for (const number of contacts) {
    let allChunksSent = true;
    let errors = [];
    let senderUsed = 'Mock Mode';

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunkText = chunks[cIdx];
      let chunkSent = false;

      // 1. Try Fast2SMS if key is present
      if (FAST2SMS_API_KEY) {
        try {
          const cleanNumber = number.replace(/^\+91/, '').replace(/\s+/g, '');
          const payload = {
            route: 'q',
            message: chunkText,
            numbers: cleanNumber
          };

          const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
              'authorization': FAST2SMS_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const resData = await response.json();
          if (response.ok && resData.return) {
            chunkSent = true;
            senderUsed = 'Fast2SMS';
          } else {
            const errMsg = resData.message || 'API error';
            errors.push(`Fast2SMS [Chunk ${cIdx+1}/${chunks.length}]: ${errMsg}`);
          }
        } catch (err) {
          errors.push(`Fast2SMS [Chunk ${cIdx+1}/${chunks.length}]: ${err.message}`);
        }
      }

      // 2. Try Twilio if not sent and credentials are set
      if (!chunkSent && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
        try {
          const accountSid = TWILIO_ACCOUNT_SID;
          const authToken = TWILIO_AUTH_TOKEN;
          const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

          let formattedNumber = number.trim();
          if (/^\d{10}$/.test(formattedNumber)) {
            formattedNumber = '+91' + formattedNumber;
          } else if (!formattedNumber.startsWith('+')) {
            formattedNumber = '+' + formattedNumber;
          }

          const bodyParams = new URLSearchParams({
            From: TWILIO_FROM_NUMBER,
            To: formattedNumber,
            Body: chunkText
          });

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyParams
          });

          const resData = await response.json();
          if (response.ok && !resData.error_code) {
            chunkSent = true;
            senderUsed = 'Twilio';
          } else {
            const errMsg = resData.message || 'API error';
            errors.push(`Twilio [Chunk ${cIdx+1}/${chunks.length}]: ${errMsg}`);
          }
        } catch (err) {
          errors.push(`Twilio [Chunk ${cIdx+1}/${chunks.length}]: ${err.message}`);
        }
      }

      // 3. Mock if still not sent and no API keys configured
      if (!chunkSent) {
        if (!FAST2SMS_API_KEY && (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER)) {
          console.log(`[SMS Mock Mode] Sending SMS to ${number} [Chunk ${cIdx+1}/${chunks.length}]:\n--------------------\n${chunkText}\n--------------------`);
          chunkSent = true;
          senderUsed = 'Mock Mode';
        }
      }

      if (!chunkSent) {
        allChunksSent = false;
        break; // Stop sending subsequent chunks if one fails
      }
    }

    if (allChunksSent) {
      results.push({ number, success: true, api: senderUsed, chunks: chunks.length });
    } else {
      results.push({ number, success: false, errors });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount > 0,
    message: `SMS report sent to ${successCount} of ${contacts.length} numbers.`,
    results
  };
}

module.exports = {
  generateDailyWarehouseSummaryText,
  sendSmsReport
};
