const TWILIO_ACCOUNT_SID = ((process.env.TWILIO_ACCOUNT_SID || '').trim().replace(/['"]+/g, '').match(/AC[a-f0-9]{32}/i) || [])[0] || '';
const TWILIO_AUTH_TOKEN = ((process.env.TWILIO_AUTH_TOKEN || '').trim().replace(/['"]+/g, '').match(/[a-f0-9]{32}/i) || [])[0] || '';
const TWILIO_WHATSAPP_FROM = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim().replace(/['"]+/g, '');

/**
 * Generates the text report containing:
 * 1. Warehouse items with stock quantity > 0
 * 2. Active sites that have crossed 15 days since lintelDate (inclusive of lintel day itself, i.e., daysPassed > 15)
 * WITH emojis included for premium presentation on WhatsApp.
 */
async function generateDailyWarehouseSummaryWhatsApp({ date, models }) {
  const Material   = models.Material;
  const Incoming   = models.Incoming;
  const Outgoing   = models.Outgoing;
  const SiteReturns = models.SiteReturns;
  const RentalSite = models.RentalSite;
  const Site       = models.Site;

  const materials   = await Material.find({ status: { $ne: 'Archived' } });
  const sites       = await Site.find({ status: 'Active' });
  const allIncoming = await Incoming.find({});
  const allOutgoing = await Outgoing.find({});
  const allReturns  = await SiteReturns.find({});
  const allRentals  = await RentalSite.find({});

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

  const warehouseRows = materials.map(m => {
    const mId = String(m._id || m.id);
    return { name: m.name, unit: m.unit || 'Nos', qty: currentStockMap[mId] || 0 };
  })
  .filter(r => r.qty > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

  const lintelAlertSites = [];
  sites.forEach(s => {
    if (s.lintelDate) {
      const [ly, lm, ld] = s.lintelDate.split('-').map(Number);
      const [ry, rm, rd] = date.split('-').map(Number);
      const lintelDateObj = new Date(ly, lm - 1, ld);
      const reportDateObj = new Date(ry, rm - 1, rd);

      lintelDateObj.setHours(0,0,0,0);
      reportDateObj.setHours(0,0,0,0);

      const diffTime = reportDateObj.getTime() - lintelDateObj.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const daysCount = diffDays + 1;

      if (daysCount > 15) {
        lintelAlertSites.push({
          name: s.name,
          customerName: s.customerName,
          lintelDate: s.lintelDate,
          daysPassed: daysCount
        });
      }
    }
  });

  lintelAlertSites.sort((a, b) => b.daysPassed - a.daysPassed);

  const [yr, mo, dy] = date.split('-').map(Number);
  const dateFormatted = new Date(yr, mo - 1, dy).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let text = `📋 *KSS Daily Warehouse & Site Lintel Report*\n📅 *Date:* ${dateFormatted}\n\n`;
  
  text += `🏢 *Warehouse Stock:*\n`;
  if (warehouseRows.length === 0) {
    text += `_- No stock in warehouse_\n`;
  } else {
    warehouseRows.forEach(row => {
      text += `- ${row.name}: *${row.qty.toLocaleString('en-IN')}* ${row.unit}\n`;
    });
  }

  text += `\n📍 *Sites Crossed 15 Days (Lintel):*\n`;
  if (lintelAlertSites.length === 0) {
    text += `_- None_\n`;
  } else {
    lintelAlertSites.forEach(s => {
      const custStr = s.customerName ? ` (${s.customerName})` : '';
      text += `- *${s.name}*${custStr}: *${s.daysPassed}* Days (since ${s.lintelDate})\n`;
    });
  }

  return text;
}

/**
 * Sends the WhatsApp report via Twilio WhatsApp API to configured recipients.
 */
async function sendWhatsappReport({ date, models }) {
  let contacts = [];
  try {
    const list = await models.WhatsappContact.find({});
    contacts = list.map(c => String(c._id || c.id).trim());
  } catch (err) {
    console.error('Error fetching WhatsApp contacts from DB:', err);
  }

  // Fallback to environment variable recipients
  if (process.env.WHATSAPP_RECIPIENTS) {
    const envRecipients = process.env.WHATSAPP_RECIPIENTS.split(',').map(r => r.trim()).filter(Boolean);
    contacts = [...new Set([...contacts, ...envRecipients])];
  }

  if (contacts.length === 0) {
    return {
      success: false,
      message: 'No WhatsApp recipients configured in DB or .env.'
    };
  }

  let reportText;
  try {
    reportText = await generateDailyWarehouseSummaryWhatsApp({ date, models });
  } catch (err) {
    console.error('Error generating report text:', err);
    throw new Error('Report text generation failed: ' + err.message);
  }

  const results = [];

  for (const number of contacts) {
    let sent = false;
    let errors = [];
    let senderUsed = 'Mock Mode';

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const accountSid = TWILIO_ACCOUNT_SID;
        const authToken = TWILIO_AUTH_TOKEN;
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        let formattedNumber = number.trim();
        // Twilio WhatsApp expects the format: whatsapp:+919876543210
        if (!formattedNumber.startsWith('whatsapp:')) {
          if (/^\d{10}$/.test(formattedNumber)) {
            formattedNumber = 'whatsapp:+91' + formattedNumber;
          } else if (formattedNumber.startsWith('+')) {
            formattedNumber = 'whatsapp:' + formattedNumber;
          } else {
            formattedNumber = 'whatsapp:+' + formattedNumber;
          }
        }

        const bodyParams = new URLSearchParams({
          From: TWILIO_WHATSAPP_FROM,
          To: formattedNumber,
          Body: reportText
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
          sent = true;
          senderUsed = 'Twilio WhatsApp';
        } else {
          const errMsg = resData.message || 'API error';
          errors.push(`Twilio: ${errMsg}`);
        }
      } catch (err) {
        errors.push(`Twilio: ${err.message}`);
      }
    }

    if (!sent) {
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.log(`[WhatsApp Mock Mode] Sending WhatsApp to ${number}:\n--------------------\n${reportText}\n--------------------`);
        sent = true;
        senderUsed = 'Mock Mode';
      }
    }

    if (sent) {
      results.push({ number, success: true, api: senderUsed });
    } else {
      results.push({ number, success: false, errors });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount > 0,
    message: `WhatsApp report sent to ${successCount} of ${contacts.length} numbers.`,
    results
  };
}

module.exports = {
  generateDailyWarehouseSummaryWhatsApp,
  sendWhatsappReport
};
