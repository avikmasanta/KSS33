const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33';
mongoose.connect(MONGO_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api', require('./routes'));

// Daily Cron Job at 8:00 AM local time
const cron = require('node-cron');
const { sendTelegramReport } = require('./telegramService');
const { sendWhatsappReport } = require('./whatsappService');
const { sendSmsReport } = require('./smsService');
const models = require('./models');

// '0 8 * * *' = at 08:00 AM every day
cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Running daily warehouse summary report job...');
  try {
    function getYesterdayIST() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
      const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString().split('T')[0];
    }

    const yesterdayStr = getYesterdayIST();
    console.log(`[Cron] Target date: ${yesterdayStr}`);

    const reportModels = {
      Material: models.Material,
      Incoming: models.Incoming,
      Outgoing: models.Outgoing,
      SiteReturns: models.SiteReturns,
      RentalSite: models.RentalSite,
      Site: models.Site,
      TelegramChat: models.TelegramChat,
      SiteUsage: models.SiteUsage,
      SiteDamaged: models.SiteDamaged,
      WhatsappContact: models.WhatsappContact,
      SmsContact: models.SmsContact
    };

    // Send Telegram
    try {
      const tgResult = await sendTelegramReport({ date: yesterdayStr, models: reportModels });
      console.log('[Cron] Telegram job completed:', tgResult.message);
    } catch (tgErr) {
      console.error('[Cron] Telegram job failed:', tgErr);
    }

    // Send WhatsApp
    try {
      const waResult = await sendWhatsappReport({ date: yesterdayStr, models: reportModels });
      console.log('[Cron] WhatsApp job completed:', waResult);
    } catch (waErr) {
      console.error('[Cron] WhatsApp job failed:', waErr);
    }

    // Send SMS
    try {
      const smsResult = await sendSmsReport({ date: yesterdayStr, models: reportModels });
      console.log('[Cron] SMS job completed:', smsResult);
    } catch (smsErr) {
      console.error('[Cron] SMS job failed:', smsErr);
    }

  } catch (err) {
    console.error('[Cron] Job failed:', err);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
