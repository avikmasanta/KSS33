const { generateDailyWarehouseSummary } = require('./reportGenerator');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8972213770:AAFs_jZDhWOefugIbXsSxdY72Jwsv5cyThI';

/**
 * Generates and sends the daily report to all configured Telegram Chat IDs.
 * @param {Object} params
 * @param {string} params.date - YYYY-MM-DD
 * @param {Object} params.models - Database models
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

  const results = [];
  const dateFormatted = new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // 3. Send to each chat ID
  for (const chatId of chatIds) {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('document', blob, `KSS_Warehouse_Summary_${date}.pdf`);
      formData.append(
        'caption',
        `📋 *Daily Warehouse Summary Report*\n📅 *Date:* ${dateFormatted}\n🏢 *System:* KSS Construction Materials\n\nGenerated automatically at 8:00 AM.`
      );

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (response.ok && resData.ok) {
        results.push({ chatId, success: true });
      } else {
        console.error(`Telegram API error for chat ${chatId}:`, resData);
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
