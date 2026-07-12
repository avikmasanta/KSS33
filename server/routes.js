const express = require('express');
const router = express.Router();
const models = require('./models');

// Generic CRUD factory
function createCrudRoutes(modelName, Model) {
  const r = express.Router();

  // Get all
  r.get('/', async (req, res) => {
    try {
      const items = await Model.find();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get by ID
  r.get('/:id', async (req, res) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create
  r.post('/', async (req, res) => {
    try {
      if (req.body.id) {
        req.body._id = req.body.id;
      }
      if (!req.body.createdAt) {
        const now = new Date();
        const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        req.body.createdAt = ist.toISOString().split('T')[0];
      }
      const newItem = new Model(req.body);
      const saved = await newItem.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update
  r.put('/:id', async (req, res) => {
    try {
      const body = { ...req.body, _id: req.params.id };
      const updated = await Model.findByIdAndUpdate(req.params.id, body, { new: true, upsert: true });
      if (!updated) return res.status(404).json({ error: 'Not found' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });


  // Delete
  r.delete('/:id', async (req, res) => {
    try {
      const deleted = await Model.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return r;
}

router.use('/customers', createCrudRoutes('Customer', models.Customer));
router.use('/sites', createCrudRoutes('Site', models.Site));
router.use('/materials', createCrudRoutes('Material', models.Material));
router.use('/incoming', createCrudRoutes('Incoming', models.Incoming));
router.use('/outgoing', createCrudRoutes('Outgoing', models.Outgoing));
router.use('/siteUsage', createCrudRoutes('SiteUsage', models.SiteUsage));
router.use('/siteReturns', createCrudRoutes('SiteReturns', models.SiteReturns));
router.use('/siteDamaged', createCrudRoutes('SiteDamaged', models.SiteDamaged));
router.use('/siteExpenses', createCrudRoutes('SiteExpenses', models.SiteExpenses));
router.use('/sitePayments', createCrudRoutes('SitePayments', models.SitePayments));
router.use('/transactions', createCrudRoutes('Transaction', models.Transaction));
router.use('/rentalSites', createCrudRoutes('RentalSite', models.RentalSite));
router.use('/categories', createCrudRoutes('Category', models.Category));
router.use('/telegramChats', createCrudRoutes('TelegramChat', models.TelegramChat));
router.use('/smsContacts', createCrudRoutes('SmsContact', models.SmsContact));
router.use('/whatsappContacts', createCrudRoutes('WhatsappContact', models.WhatsappContact));


// Special Cascade Delete for Sites
router.delete('/sites/:id/cascade', async (req, res) => {
  const id = req.params.id;
  try {
    await models.Outgoing.deleteMany({ siteId: id });
    await models.Incoming.deleteMany({ destinationType: 'site', destinationSiteId: id });
    await models.SiteReturns.deleteMany({ siteId: id });
    await models.SiteUsage.deleteMany({ siteId: id });
    await models.SiteDamaged.deleteMany({ siteId: id });
    await models.SiteExpenses.deleteMany({ siteId: id });
    await models.SitePayments.deleteMany({ siteId: id });
    const deleted = await models.Site.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Site not found' });
    res.json({ message: 'Cascade deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Stock
router.post('/reset-stock', async (req, res) => {
  try {
    await models.Incoming.deleteMany({});
    await models.Outgoing.deleteMany({});
    await models.SiteReturns.deleteMany({});
    await models.SiteUsage.deleteMany({});
    await models.SiteDamaged.deleteMany({});
    await models.RentalSite.deleteMany({});
    if (models.Transaction) {
      await models.Transaction.deleteMany({});
    }
    res.json({ message: 'Stock reset completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily Warehouse Summary Telegram endpoints
router.get('/telegram-report/preview', async (req, res) => {
  function getYesterdayIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }

  const reportDate = req.query.date || getYesterdayIST();
  const reportModels = {
    Material: models.Material,
    Incoming: models.Incoming,
    Outgoing: models.Outgoing,
    SiteReturns: models.SiteReturns,
    RentalSite: models.RentalSite,
    Site: models.Site,
    TelegramChat: models.TelegramChat,
    SiteUsage: models.SiteUsage,
    SiteDamaged: models.SiteDamaged
  };

  try {
    const { generateDailyWarehouseSummary } = require('./reportGenerator');
    const pdfBuffer = await generateDailyWarehouseSummary({ date: reportDate, models: reportModels });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="KSS_Warehouse_Summary_${reportDate}.pdf"`);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF preview: ' + err.message });
  }
});

router.all('/telegram-report/send', async (req, res) => {
  function getYesterdayIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }

  const reportDate = req.query.date || getYesterdayIST();
  const reportModels = {
    Material: models.Material,
    Incoming: models.Incoming,
    Outgoing: models.Outgoing,
    SiteReturns: models.SiteReturns,
    RentalSite: models.RentalSite,
    Site: models.Site,
    TelegramChat: models.TelegramChat,
    SiteUsage: models.SiteUsage,
    SiteDamaged: models.SiteDamaged
  };

  try {
    const { sendTelegramReport } = require('./telegramService');
    const result = await sendTelegramReport({ date: reportDate, models: reportModels });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send Telegram report: ' + err.message });
  }
});

// Daily Warehouse Summary SMS endpoints
router.get('/sms-report/preview', async (req, res) => {
  function getYesterdayIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }

  const reportDate = req.query.date || getYesterdayIST();
  const reportModels = {
    Material: models.Material,
    Incoming: models.Incoming,
    Outgoing: models.Outgoing,
    SiteReturns: models.SiteReturns,
    RentalSite: models.RentalSite,
    Site: models.Site,
    SmsContact: models.SmsContact,
    SiteUsage: models.SiteUsage,
    SiteDamaged: models.SiteDamaged
  };

  try {
    const { generateDailyWarehouseSummaryText } = require('./smsService');
    const text = await generateDailyWarehouseSummaryText({ date: reportDate, models: reportModels });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate SMS preview: ' + err.message });
  }
});

router.all('/sms-report/send', async (req, res) => {
  function getYesterdayIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }

  const reportDate = req.query.date || getYesterdayIST();
  const reportModels = {
    Material: models.Material,
    Incoming: models.Incoming,
    Outgoing: models.Outgoing,
    SiteReturns: models.SiteReturns,
    RentalSite: models.RentalSite,
    Site: models.Site,
    SmsContact: models.SmsContact,
    SiteUsage: models.SiteUsage,
    SiteDamaged: models.SiteDamaged
  };

  try {
    const { sendSmsReport } = require('./smsService');
    const result = await sendSmsReport({ date: reportDate, models: reportModels });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send SMS report: ' + err.message });
  }
});

// Daily Warehouse Summary WhatsApp endpoints
router.get('/whatsapp-report/preview', async (req, res) => {
  function getYesterdayIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }

  const reportDate = req.query.date || getYesterdayIST();
  const reportModels = {
    Material: models.Material,
    Incoming: models.Incoming,
    Outgoing: models.Outgoing,
    SiteReturns: models.SiteReturns,
    RentalSite: models.RentalSite,
    Site: models.Site,
    WhatsappContact: models.WhatsappContact,
    SiteUsage: models.SiteUsage,
    SiteDamaged: models.SiteDamaged
  };

  try {
    const { generateDailyWarehouseSummaryWhatsApp } = require('./whatsappService');
    const text = await generateDailyWarehouseSummaryWhatsApp({ date: reportDate, models: reportModels });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate WhatsApp preview: ' + err.message });
  }
});

router.all('/whatsapp-report/send', async (req, res) => {
  function getYesterdayIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
    const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }

  const reportDate = req.query.date || getYesterdayIST();
  const reportModels = {
    Material: models.Material,
    Incoming: models.Incoming,
    Outgoing: models.Outgoing,
    SiteReturns: models.SiteReturns,
    RentalSite: models.RentalSite,
    Site: models.Site,
    WhatsappContact: models.WhatsappContact,
    SiteUsage: models.SiteUsage,
    SiteDamaged: models.SiteDamaged
  };

  try {
    const { sendWhatsappReport } = require('./whatsappService');
    const result = await sendWhatsappReport({ date: reportDate, models: reportModels });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send WhatsApp report: ' + err.message });
  }
});

module.exports = router;
