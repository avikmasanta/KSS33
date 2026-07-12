const { generateDailyWarehouseSummary } = require('./reportGenerator');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8972213770:AAFs_jZDhWOefugIbXsSxdY72Jwsv5cyThI';

/**
 * Generates the clean readable operations summary text (Warehouse, Sites, Rentals, Lintel)
 */
async function generateTelegramReportText({ date, models }) {
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

  // 1. Calculate Warehouse Stock
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

  // 2. Calculate Active Site Materials
  const activeSitesData = [];
  for (const s of sites) {
    const siteItems = [];
    materials.forEach(m => {
      const mId = String(m._id || m.id);
      let sent = 0;
      let returned = 0;

      allOutgoing.filter(r => String(r.siteId) === String(s._id || s.id)).forEach(r => {
        (r.items || []).forEach(i => {
          if (String(i.materialId) === mId) sent += parseFloat(i.quantity) || 0;
        });
      });

      allReturns.filter(r => String(r.siteId) === String(s._id || s.id)).forEach(r => {
        if (String(r.materialId) === mId) returned += parseFloat(r.quantity) || 0;
      });

      const balance = sent - returned;
      if (balance > 0) {
        siteItems.push({ name: m.name, qty: balance, unit: m.unit || 'Nos' });
      }
    });

    if (siteItems.length > 0) {
      activeSitesData.push({ name: s.name, customer: s.customerName, items: siteItems });
    }
  }

  // 3. Calculate Active Rentals
  const activeRentalsData = [];
  allRentals.filter(r => r.status === 'Active').forEach(r => {
    const rentalItems = [];
    (r.items || []).forEach(i => {
      const qty = parseFloat(i.quantity) || 0;
      if (qty > 0) {
        const mat = materials.find(m => String(m._id || m.id) === String(i.materialId));
        if (mat) {
          rentalItems.push({ name: mat.name, qty, unit: mat.unit || 'Nos' });
        }
      }
    });

    if (rentalItems.length > 0) {
      activeRentalsData.push({ name: r.siteName, customer: r.customerName, items: rentalItems });
    }
  });

  // 4. Calculate Sites Crossed 13 Days (Lintel)
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

      if (daysCount > 13) {
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

  // 5. Format Date
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateFormatted = new Date(yr, mo - 1, dy).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // 6. Build Text Message
  let text = `📋 *KSS Daily Warehouse & Site Lintel Report*\n📅 *Date:* ${dateFormatted}\n\n`;

  // Warehouse Stock
  text += `🏢 *Warehouse Stock:*\n`;
  if (warehouseRows.length === 0) {
    text += `_- No stock in warehouse_\n`;
  } else {
    warehouseRows.forEach(row => {
      text += `- ${row.name}: *${row.qty.toLocaleString('en-IN')}* ${row.unit}\n`;
    });
  }

  // Active Sites
  text += `\n📍 *Active Sites (Net Balance):*\n`;
  if (activeSitesData.length === 0) {
    text += `_- No active sites_\n`;
  } else {
    activeSitesData.forEach(site => {
      const custStr = site.customer ? ` (${site.customer})` : '';
      text += `*${site.name}*${custStr}:\n`;
      site.items.forEach(item => {
        text += `  - ${item.name}: *${item.qty.toLocaleString('en-IN')}* ${item.unit}\n`;
      });
    });
  }

  // Active Rentals
  text += `\n🏠 *Active Rentals:*\n`;
  if (activeRentalsData.length === 0) {
    text += `_- No active rentals_\n`;
  } else {
    activeRentalsData.forEach(rental => {
      const custStr = rental.customer ? ` (${rental.customer})` : '';
      text += `*${rental.name}*${custStr}:\n`;
      rental.items.forEach(item => {
        text += `  - ${item.name}: *${item.qty.toLocaleString('en-IN')}* ${item.unit}\n`;
      });
    });
  }

  // Lintel Warnings
  text += `\n⏳ *Sites Crossed 13 Days (Lintel):*\n`;
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
 * Generates and sends the daily report to all configured Telegram Chat IDs.
 */
async function sendTelegramReport({ date, models }) {
  // 1. Fetch configured Telegram Chat IDs
  let chatIds = [];
  try {
    const chats = await models.TelegramChat.find({});
    chatIds = chats.map(c => String(c._id || c.id));
  } catch (err) {
    console.error('Error fetching Telegram chats from DB:', err);
  }

  // Fallback to environment variable
  if (process.env.TELEGRAM_CHAT_IDS) {
    const envIds = process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim()).filter(Boolean);
    chatIds = [...new Set([...chatIds, ...envIds])];
  }

  if (chatIds.length === 0) {
    return {
      success: false,
      message: 'No Telegram Chat IDs configured. Please configure chat IDs in the admin dashboard.',
      results: []
    };
  }

  // 2. Generate PDF
  let pdfBuffer;
  try {
    pdfBuffer = await generateDailyWarehouseSummary({ date, models });
  } catch (err) {
    console.error('Error generating PDF:', err);
    throw new Error('PDF generation failed: ' + err.message);
  }

  // 3. Generate Markdown text summary
  let reportText = '';
  try {
    reportText = await generateTelegramReportText({ date, models });
  } catch (err) {
    console.error('Error generating Telegram report text:', err);
    reportText = 'Error generating daily summary text.';
  }

  const results = [];

  // 4. Send to each chat ID
  for (const chatId of chatIds) {
    try {
      // Step A: Send the detailed text summary first
      const textUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const textResponse = await fetch(textUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: reportText,
          parse_mode: 'Markdown'
        })
      });

      const textResData = await textResponse.json();
      if (!textResponse.ok || !textResData.ok) {
        console.error(`Telegram API text error for chat ${chatId}:`, textResData);
      }

      // Step B: Send the PDF document backup
      const formData = new FormData();
      formData.append('chat_id', chatId);

      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('document', blob, `KSS_Warehouse_Summary_${date}.pdf`);
      formData.append(
        'caption',
        `📋 *Daily PDF Backup*\n🏢 KSS Construction Materials\n\nDownload for offline copy.`
      );

      const docUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
      const response = await fetch(docUrl, {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (response.ok && resData.ok) {
        results.push({ chatId, success: true });
      } else {
        console.error(`Telegram API document error for chat ${chatId}:`, resData);
        results.push({ chatId, success: false, error: resData.description || 'Unknown error' });
      }
    } catch (err) {
      console.error(`Failed to send telegram report to ${chatId}:`, err);
      results.push({ chatId, success: false, error: err.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount > 0,
    message: `Report sent to ${successCount} of ${chatIds.length} configured chats.`,
    results
  };
}

module.exports = { sendTelegramReport };
