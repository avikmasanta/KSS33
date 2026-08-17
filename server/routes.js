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

function sanitizeDocument(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(sanitizeDocument);
  if (obj.constructor && obj.constructor.name !== 'Object') {
    return String(obj);
  }
  const clean = {};
  for (const k of Object.keys(obj)) {
    if (k === '__v') continue;
    clean[k] = sanitizeDocument(obj[k]);
  }
  return clean;
}

  // Create / Upsert
  r.post('/', async (req, res) => {
    try {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const docId = String(body.id || body._id || `id_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
      if (!body.createdAt) {
        const now = new Date();
        const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        body.createdAt = ist.toISOString().split('T')[0];
      }
      const cleanData = sanitizeDocument(body);
      cleanData._id = docId;
      cleanData.id = docId;

      await Model.collection.updateOne(
        { _id: docId },
        { $set: cleanData },
        { upsert: true }
      );
      res.status(201).json(cleanData);
    } catch (err) {
      res.status(200).json({ warning: err.message, skipped: true });
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

// Batch Sync Route
router.get('/sync', async (req, res) => {
  try {
    const map = {
      customers: models.Customer,
      sites: models.Site,
      materials: models.Material,
      incoming: models.Incoming,
      outgoing: models.Outgoing,
      siteUsage: models.SiteUsage,
      siteReturns: models.SiteReturns,
      siteDamaged: models.SiteDamaged,
      siteExpenses: models.SiteExpenses,
      sitePayments: models.SitePayments,
      transactions: models.Transaction,
      rentalSites: models.RentalSite,
      categories: models.Category,
      telegramChats: models.TelegramChat,
      smsContacts: models.SmsContact,
      whatsappContacts: models.WhatsappContact,
      separateBillings: models.SeparateBilling,
      labours: models.Labour,
      labourLogs: models.LabourLog
    };

    const results = {};
    await Promise.all(Object.entries(map).map(async ([key, Model]) => {
      if (Model) {
        results[key] = await Model.find();
      }
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

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
router.use('/separateBillings', createCrudRoutes('SeparateBilling', models.SeparateBilling));
router.use('/labours', createCrudRoutes('Labour', models.Labour));
router.use('/labourLogs', createCrudRoutes('LabourLog', models.LabourLog));



// Special Cascade Delete for Sites
router.delete('/sites/:id/cascade', async (req, res) => {
  const id = req.params.id;
  try {
    // Preserve Outgoing and SiteReturns to ensure returned warehouse inventory stock is permanently recorded and never reverts
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

router.post('/reset-stock', async (req, res) => {
  try {
    // 1. Clear non-site warehouse incoming and transaction logs
    await models.Incoming.deleteMany({ destinationType: { $ne: 'site' } });
    if (models.Transaction) {
      await models.Transaction.deleteMany({});
    }

    // 2. Fetch active site dispatches, site returns, and active rentals
    const allOutgoing = await models.Outgoing.find();
    const allReturns = await models.SiteReturns.find();
    const allRentals = await models.RentalSite.find({ status: 'Active' });
    const allMaterials = await models.Material.find();

    const resolveId = (id) => String(id || '');
    const balancingItems = [];

    for (const mat of allMaterials) {
      const matId = resolveId(mat._id || mat.id);
      let totalOut = 0;
      allOutgoing.forEach(r => {
        (r.items || []).forEach(i => {
          if (resolveId(i.materialId) === matId) totalOut += (parseFloat(i.quantity) || 0);
        });
      });

      let totalRet = 0;
      allReturns.forEach(r => {
        if (resolveId(r.materialId) === matId) totalRet += (parseFloat(r.quantity) || 0);
      });

      let totalRented = 0;
      allRentals.forEach(r => {
        (r.items || []).forEach(i => {
          if (resolveId(i.materialId) === matId) totalRented += (parseFloat(i.quantity) || 0);
        });
      });

      const requiredIn = Math.max(0, totalOut + totalRented - totalRet);
      if (requiredIn > 0) {
        balancingItems.push({
          materialId: matId,
          quantity: requiredIn,
          rate: mat.unitPrice || 0,
          amount: requiredIn * (mat.unitPrice || 0)
        });
      }
    }

    if (balancingItems.length > 0) {
      const resetDoc = {
        _id: 'inc_reset_' + Date.now(),
        id: 'inc_reset_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        vendorName: 'Warehouse Stock Reset (Zero Balancing)',
        referenceNo: 'RESET-BALANCING',
        destinationType: 'warehouse',
        destinationSiteId: '',
        items: balancingItems,
        notes: 'Automatic balancing record to keep warehouse stock at 0 while preserving all site dispatches, returns and rentals.',
        createdAt: new Date().toISOString()
      };
      await models.Incoming.create(resetDoc);
    }

    res.json({ message: 'Warehouse stock successfully reset to zero' });
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
    SiteDamaged: models.SiteDamaged,
    Labour: models.Labour,
    LabourLog: models.LabourLog,
    SeparateBilling: models.SeparateBilling,
    SiteExpenses: models.SiteExpenses,
    SitePayments: models.SitePayments
  };

  try {
    const { generateDailyWarehouseSummary } = require('./reportGenerator');
    const includeSiteChallans = req.query.includeSiteChallans === 'true';
    const pdfBuffer = await generateDailyWarehouseSummary({ date: reportDate, models: reportModels, includeSiteChallans });
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
    SiteDamaged: models.SiteDamaged,
    Labour: models.Labour,
    LabourLog: models.LabourLog,
    SeparateBilling: models.SeparateBilling
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

// Custom aggregation routes for Labour Module
router.get('/labours-summary', async (req, res) => {
  try {
    const { startDate, endDate, siteId, labourId, attendance } = req.query;

    function getTodayIST() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
      return istTime.toISOString().split('T')[0];
    }

    const logMatch = {};
    if (startDate || endDate) {
      logMatch.date = {};
      if (startDate) logMatch.date.$gte = startDate;
      if (endDate) logMatch.date.$lte = endDate;
    }
    if (siteId) logMatch.siteId = siteId;
    if (labourId) logMatch.labourId = labourId;
    if (attendance) logMatch.attendance = attendance;

    // Create aggregation pipeline to summarize details per labour
    const pipeline = [];

    // Filter by specific labour ID if requested
    if (labourId) {
      pipeline.push({ $match: { _id: labourId } });
    }

    pipeline.push({
      $lookup: {
        from: 'labour_logs',
        localField: '_id',
        foreignField: 'labourId',
        as: 'rawLogs'
      }
    });

    const filterConds = [];
    if (startDate) filterConds.push({ $gte: ["$$log.date", startDate] });
    if (endDate) filterConds.push({ $lte: ["$$log.date", endDate] });
    if (siteId) filterConds.push({ $eq: ["$$log.siteId", siteId] });
    if (attendance) filterConds.push({ $eq: ["$$log.attendance", attendance] });

    pipeline.push({
      $addFields: {
        logs: {
          $filter: {
            input: "$rawLogs",
            as: "log",
            cond: filterConds.length === 0
              ? true
              : (filterConds.length === 1 ? filterConds[0] : { $and: filterConds })
          }
        }
      }
    });


    pipeline.push({
      $project: {
        name: 1,
        nickname: 1,
        phone: 1,
        status: 1,
        createdAt: 1,
        stats: {
          $reduce: {
            input: "$logs",
            initialValue: {
              presentDays: 0,
              halfDays: 0,
              absentDays: 0,
              grossWages: 0,
              totalOvertime: 0,
              totalOvertimeHours: 0,
              totalMoneyGiven: 0,
              presentDates: [],
              halfDayDates: [],
              absentDates: [],
              overtimeLogs: [],
              paymentLogs: []
            },
            in: {
              presentDays: {
                $add: [
                  "$$value.presentDays",
                  { $cond: [{ $eq: ["$$this.attendance", "Present"] }, 1, 0] }
                ]
              },
              halfDays: {
                $add: [
                  "$$value.halfDays",
                  { $cond: [{ $eq: ["$$this.attendance", "Half Day"] }, 1, 0] }
                ]
              },
              absentDays: {
                $add: [
                  "$$value.absentDays",
                  { $cond: [{ $eq: ["$$this.attendance", "Absent"] }, 1, 0] }
                ]
              },
              grossWages: {
                $add: [
                  "$$value.grossWages",
                  {
                    $multiply: [
                      { $ifNull: ["$$this.dailyWage", 0] },
                      {
                        $cond: [
                          { $eq: ["$$this.attendance", "Present"] }, 1.0,
                          { $cond: [{ $eq: ["$$this.attendance", "Half Day"] }, 0.5, 0.0] }
                        ]
                      }
                    ]
                  }
                ]
              },
              totalOvertime: {
                $add: [
                  "$$value.totalOvertime",
                  {
                    $cond: [
                      { $gt: [{ $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }, 0] },
                      {
                        $multiply: [
                          { $divide: [{ $toDouble: { $ifNull: ["$$this.dailyWage", 0] } }, 8] },
                          { $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }
                        ]
                      },
                      { $toDouble: { $ifNull: ["$$this.overtime", 0] } }
                    ]
                  }
                ]
              },
              totalOvertimeHours: {
                $add: [
                  "$$value.totalOvertimeHours",
                  {
                    $cond: [
                      { $gt: [{ $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }, 0] },
                      { $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } },
                      {
                        $cond: [
                          {
                            $and: [
                              { $gt: [{ $toDouble: { $ifNull: ["$$this.overtime", 0] } }, 0] },
                              { $gt: [{ $toDouble: { $ifNull: ["$$this.dailyWage", 0] } }, 0] }
                            ]
                          },
                          {
                            $divide: [
                              { $multiply: [{ $toDouble: { $ifNull: ["$$this.overtime", 0] } }, 8] },
                              { $toDouble: { $ifNull: ["$$this.dailyWage", 0] } }
                            ]
                          },
                          0
                        ]
                      }
                    ]
                  }
                ]
              },
              totalMoneyGiven: { $add: ["$$value.totalMoneyGiven", { $ifNull: ["$$this.moneyGiven", 0] }] },
              presentDates: {
                $concatArrays: [
                  "$$value.presentDates",
                  { $cond: [{ $eq: ["$$this.attendance", "Present"] }, ["$$this.date"], []] }
                ]
              },
              halfDayDates: {
                $concatArrays: [
                  "$$value.halfDayDates",
                  { $cond: [{ $eq: ["$$this.attendance", "Half Day"] }, ["$$this.date"], []] }
                ]
              },
              absentDates: {
                $concatArrays: [
                  "$$value.absentDates",
                  { $cond: [{ $eq: ["$$this.attendance", "Absent"] }, ["$$this.date"], []] }
                ]
              },
              overtimeLogs: {
                $concatArrays: [
                  "$$value.overtimeLogs",
                  {
                    $cond: [
                      {
                        $or: [
                          { $gt: [{ $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }, 0] },
                          { $gt: [{ $toDouble: { $ifNull: ["$$this.overtime", 0] } }, 0] }
                        ]
                      },
                      [{
                        date: "$$this.date",
                        hours: {
                          $round: [
                            {
                              $cond: [
                                { $gt: [{ $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }, 0] },
                                { $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } },
                                {
                                  $cond: [
                                    { $gt: [{ $toDouble: { $ifNull: ["$$this.dailyWage", 0] } }, 0] },
                                    {
                                      $divide: [
                                        { $multiply: [{ $toDouble: { $ifNull: ["$$this.overtime", 0] } }, 8] },
                                        { $toDouble: { $ifNull: ["$$this.dailyWage", 0] } }
                                      ]
                                    },
                                    0
                                  ]
                                }
                              ]
                            },
                            1
                          ]
                        },
                        time: { $ifNull: ["$$this.overtimeTime", ""] },
                        pay: {
                          $cond: [
                            { $gt: [{ $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }, 0] },
                            {
                              $multiply: [
                                { $divide: [{ $toDouble: { $ifNull: ["$$this.dailyWage", 0] } }, 8] },
                                { $toDouble: { $ifNull: ["$$this.overtimeHours", 0] } }
                              ]
                            },
                            { $toDouble: { $ifNull: ["$$this.overtime", 0] } }
                          ]
                        }
                      }],
                      []
                    ]
                  }
                ]
              },
              paymentLogs: {
                $concatArrays: [
                  "$$value.paymentLogs",
                  {
                    $cond: [
                      { $gt: [{ $toDouble: { $ifNull: ["$$this.moneyGiven", 0] } }, 0] },
                      [{
                        date: "$$this.date",
                        siteId: { $ifNull: ["$$this.siteId", ""] },
                        amount: { $toDouble: { $ifNull: ["$$this.moneyGiven", 0] } },
                        notes: { $ifNull: ["$$this.notes", ""] },
                        createdAt: { $ifNull: ["$$this.createdAt", ""] }
                      }],
                      []
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    });

      pipeline.push({
        $project: {
          name: 1,
          nickname: 1,
          phone: 1,
          status: 1,
          defaultWage: 1,
          previousBalance: { $ifNull: ["$previousBalance", { $ifNull: ["$openingBalance", 0] }] },
          previousBalanceType: { $ifNull: ["$previousBalanceType", { $ifNull: ["$openingBalanceType", "payable"] }] },
          createdAt: 1,
          presentDays: "$stats.presentDays",
          halfDays: "$stats.halfDays",
          absentDays: "$stats.absentDays",
          grossWages: "$stats.grossWages",
          totalOvertime: "$stats.totalOvertime",
          totalOvertimeHours: "$stats.totalOvertimeHours",
          totalMoneyGiven: "$stats.totalMoneyGiven",
          presentDates: "$stats.presentDates",
          halfDayDates: "$stats.halfDayDates",
          absentDates: "$stats.absentDates",
          overtimeLogs: "$stats.overtimeLogs",
          paymentLogs: "$stats.paymentLogs",
          effectivePreviousBalance: {
            $cond: [
              { $eq: [{ $ifNull: ["$previousBalanceType", { $ifNull: ["$openingBalanceType", "payable"] }] }, "payable"] },
              { $toDouble: { $ifNull: ["$previousBalance", { $ifNull: ["$openingBalance", 0] }] } },
              { $multiply: [{ $toDouble: { $ifNull: ["$previousBalance", { $ifNull: ["$openingBalance", 0] }] } }, -1] }
            ]
          },
          totalEarnings: {
            $add: [
              "$stats.grossWages",
              "$stats.totalOvertime",
              {
                $cond: [
                  { $eq: [{ $ifNull: ["$previousBalanceType", { $ifNull: ["$openingBalanceType", "payable"] }] }, "payable"] },
                  { $toDouble: { $ifNull: ["$previousBalance", { $ifNull: ["$openingBalance", 0] }] } },
                  { $multiply: [{ $toDouble: { $ifNull: ["$previousBalance", { $ifNull: ["$openingBalance", 0] }] } }, -1] }
                ]
              }
            ]
          }
        }
      });

      pipeline.push({
        $project: {
          id: "$_id",
          name: 1,
          nickname: 1,
          phone: 1,
          status: 1,
          defaultWage: 1,
          previousBalance: 1,
          previousBalanceType: 1,
          effectivePreviousBalance: 1,
          createdAt: 1,
          presentDays: 1,
          halfDays: 1,
          absentDays: 1,
          grossWages: 1,
          totalOvertime: 1,
          totalOvertimeHours: 1,
          totalMoneyGiven: 1,
          totalEarnings: 1,
          presentDates: 1,
          halfDayDates: 1,
          absentDates: 1,
          overtimeLogs: 1,
          paymentLogs: 1,
          rawLogs: 1,
          payableAmount: {
            $cond: [{ $gt: ["$totalEarnings", "$totalMoneyGiven"] }, { $subtract: ["$totalEarnings", "$totalMoneyGiven"] }, 0]
          },
          advanceBalance: {
            $cond: [{ $gt: ["$totalMoneyGiven", "$totalEarnings"] }, { $subtract: ["$totalMoneyGiven", "$totalEarnings"] }, 0]
          }
        }
      });

    const laboursData = await models.Labour.aggregate(pipeline);

    // Deduplicate and consolidate date-wise logs per labour to prevent double counting
    laboursData.forEach(l => {
      if (!l.rawLogs || !Array.isArray(l.rawLogs) || l.rawLogs.length === 0) return;

      // Calculate prior balance from logs before startDate (for carried over 15-day / fortnightly hisaab)
      let priorGross = 0;
      let priorOtPay = 0;
      let priorMoneyPaid = 0;

      const dateMap = {};
      l.rawLogs.forEach(log => {
        if (!log.date) return;
        if (siteId && String(log.siteId) !== String(siteId)) return;

        // If log date is before startDate, accumulate into prior balance
        if (startDate && log.date < startDate) {
          const att = log.attendance || 'Absent';
          const attVal = att === 'Present' ? 1.0 : (att === 'Half Day' ? 0.5 : 0);
          const dw = parseFloat(log.dailyWage) || (l.defaultWage || 500);
          priorGross += dw * attVal;
          const otH = parseFloat(log.overtimeHours) || 0;
          const otP = parseFloat(log.overtime) || 0;
          priorOtPay += otH > 0 ? (dw / 8) * otH : otP;
          priorMoneyPaid += parseFloat(log.moneyGiven) || 0;
          return;
        }

        if (endDate && log.date > endDate) return;

        const d = log.date;
        if (!dateMap[d]) {
          dateMap[d] = {
            date: d,
            siteId: log.siteId || '',
            attendance: log.attendance || 'Absent',
            dailyWage: parseFloat(log.dailyWage) || (l.defaultWage || 500),
            overtimeHours: parseFloat(log.overtimeHours) || 0,
            overtime: parseFloat(log.overtime) || 0,
            moneyGiven: parseFloat(log.moneyGiven) || 0,
            notes: log.notes || ''
          };
        } else {
          const ex = dateMap[d];
          if (log.attendance === 'Present') ex.attendance = 'Present';
          else if (log.attendance === 'Half Day' && ex.attendance !== 'Present') ex.attendance = 'Half Day';

          if ((parseFloat(log.dailyWage) || 0) > ex.dailyWage) ex.dailyWage = parseFloat(log.dailyWage) || 0;
          ex.overtimeHours += (parseFloat(log.overtimeHours) || 0);
          ex.overtime += (parseFloat(log.overtime) || 0);
          ex.moneyGiven += (parseFloat(log.moneyGiven) || 0);
          if (log.notes && !ex.notes.includes(log.notes)) {
            ex.notes = ex.notes ? (ex.notes + ' | ' + log.notes) : log.notes;
          }
        }
      });

      const masterPrevBal = parseFloat(l.previousBalance) || 0;
      const masterPrevType = l.previousBalanceType || 'payable';
      const effMasterPrev = masterPrevType === 'payable' ? masterPrevBal : -masterPrevBal;
      const carriedOverBalance = Math.round(effMasterPrev + priorGross + priorOtPay - priorMoneyPaid);
      l.carriedOverBalance = carriedOverBalance;

      const uniqueDateLogs = Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date));

      let pDays = 0, hDays = 0, aDays = 0;
      let gross = 0, otHoursTotal = 0, otPayTotal = 0, moneyTotal = 0;
      const pDates = [], hDates = [], aDates = [];
      const otLogs = [], payLogs = [];

      uniqueDateLogs.forEach(log => {
        const att = log.attendance || 'Absent';
        if (attendance && att !== attendance) return;

        if (att === 'Present') {
          pDays++;
          pDates.push(log.date);
        } else if (att === 'Half Day') {
          hDays++;
          hDates.push(log.date);
        } else {
          aDays++;
          aDates.push(log.date);
        }

        const attVal = att === 'Present' ? 1.0 : (att === 'Half Day' ? 0.5 : 0);
        gross += log.dailyWage * attVal;

        const otH = log.overtimeHours;
        const otP = log.overtime;
        const otPay = otH > 0 ? (log.dailyWage / 8) * otH : otP;
        otHoursTotal += otH;
        otPayTotal += otPay;

        if (otH > 0 || otP > 0) {
          otLogs.push({ date: log.date, hours: Number(otH.toFixed(1)), pay: Math.round(otPay) });
        }

        if (log.moneyGiven > 0) {
          moneyTotal += log.moneyGiven;
          payLogs.push({ date: log.date, amount: Math.round(log.moneyGiven), notes: log.notes });
        }
      });

      const finalPDates = [...new Set(pDates)].sort();
      const finalHDates = [...new Set(hDates)].filter(d => !finalPDates.includes(d)).sort();
      const finalADates = [...new Set(aDates)].filter(d => !finalPDates.includes(d) && !finalHDates.includes(d)).sort();

      l.presentDays = finalPDates.length;
      l.halfDays = finalHDates.length;
      l.absentDays = finalADates.length;
      l.grossWages = Math.round(gross);
      l.totalOvertimeHours = Number(otHoursTotal.toFixed(1));
      l.totalOvertime = Math.round(otPayTotal);
      l.totalMoneyGiven = Math.round(moneyTotal);
      l.presentDates = finalPDates;
      l.halfDayDates = finalHDates;
      l.absentDates = finalADates;
      l.overtimeLogs = otLogs;
      l.paymentLogs = payLogs;

      const totalEarnedPeriod = l.grossWages + l.totalOvertime;
      const netConsolidated = carriedOverBalance + totalEarnedPeriod - l.totalMoneyGiven;

      l.payableAmount = netConsolidated > 0 ? Math.round(netConsolidated) : 0;
      l.advanceBalance = netConsolidated < 0 ? Math.round(Math.abs(netConsolidated)) : 0;
      delete l.rawLogs;
    });

    // Calculate dashboard counts
    const totalLabour = await models.Labour.countDocuments({});
    const todayStr = getTodayIST();
    const todayLogs = await models.LabourLog.find({ date: todayStr });
    const presentToday = todayLogs.filter(l => l.attendance === 'Present').length;
    const halfDayToday = todayLogs.filter(l => l.attendance === 'Half Day').length;
    const absentToday = todayLogs.filter(l => l.attendance === 'Absent').length;

    // Calculate dashboard grand totals (using the computed/filtered labours data)
    let overallPayable = 0;
    let overallAdvance = 0;
    laboursData.forEach(l => {
      overallPayable += l.payableAmount;
      overallAdvance += l.advanceBalance;
    });

    res.json({
      summary: {
        totalLabour,
        presentToday,
        halfDayToday,
        absentToday,
        totalPayable: overallPayable,
        totalAdvancePaid: overallAdvance
      },
      labours: laboursData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/labours/:id/logs', async (req, res) => {
  try {
    const logs = await models.LabourLog.find({ labourId: req.params.id }).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full Database Backup Export Endpoint
router.get('/backup/export', async (req, res) => {
  try {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        Customer: await models.Customer.find(),
        Site: await models.Site.find(),
        Material: await models.Material.find(),
        Incoming: await models.Incoming.find(),
        Outgoing: await models.Outgoing.find(),
        SiteReturns: await models.SiteReturns.find(),
        SiteUsage: await models.SiteUsage.find(),
        SiteDamaged: await models.SiteDamaged.find(),
        SiteExpenses: await models.SiteExpenses.find(),
        SitePayments: await models.SitePayments.find(),
        Transaction: await models.Transaction.find(),
        RentalSite: await models.RentalSite.find(),
        Category: await models.Category.find(),
        Labour: await models.Labour.find(),
        LabourLog: await models.LabourLog.find(),
        SeparateBilling: await models.SeparateBilling.find()
      }
    };
    const filename = `KSS_Full_Database_Backup_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate database backup: ' + err.message });
  }
});

// Full Database Backup Import / Restore Endpoint
router.post('/backup/import', async (req, res) => {
  try {
    const payload = req.body;
    const backupData = payload.data || payload;
    let restoredCount = 0;

    const modelMapping = {
      Customer: models.Customer,
      Site: models.Site,
      Material: models.Material,
      Incoming: models.Incoming,
      Outgoing: models.Outgoing,
      SiteReturns: models.SiteReturns,
      SiteUsage: models.SiteUsage,
      SiteDamaged: models.SiteDamaged,
      SiteExpenses: models.SiteExpenses,
      SitePayments: models.SitePayments,
      Transaction: models.Transaction,
      RentalSite: models.RentalSite,
      Category: models.Category,
      Labour: models.Labour,
      LabourLog: models.LabourLog,
      SeparateBilling: models.SeparateBilling
    };

    for (const [key, Model] of Object.entries(modelMapping)) {
      if (backupData[key] && Array.isArray(backupData[key])) {
        const bulkOps = [];
        for (const item of backupData[key]) {
          const filterId = String(item.id || item._id);
          if (filterId) {
            const cleanData = sanitizeDocument(item);
            cleanData._id = filterId;
            cleanData.id = filterId;
            bulkOps.push({
              updateOne: {
                filter: { _id: filterId },
                update: { $set: cleanData },
                upsert: true
              }
            });
            restoredCount++;
          }
        }
        if (bulkOps.length > 0) {
          await Model.bulkWrite(bulkOps, { ordered: false });
        }
      }
    }

    res.status(200).json({ message: 'Backup restored successfully!', restoredCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

module.exports = router;

