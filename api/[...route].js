const mongoose = require('mongoose');

// ─── Schema Options ───────────────────────────────────────────────
const schemaOptions = {
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
};

// ─── Schemas ──────────────────────────────────────────────────────
const schemas = {
  customers: new mongoose.Schema({ _id: String, name: String, email: String, phone: String, address: String, gst: String, status: { type: String, default: 'Active' }, createdAt: String }, schemaOptions),
  sites: new mongoose.Schema({ _id: String, customerId: String, name: String, customerName: String, gstNumber: String, contactNumber: String, status: { type: String, default: 'Active' }, startDate: String, address: String, budget: Number, ratePerSqFt: Number, tokenNumber: String, archivedAt: String, lintelDate: String, createdAt: String }, schemaOptions),
  materials: new mongoose.Schema({ _id: String, name: String, sku: String, category: String, unit: String, unitPrice: Number, reorderLevel: Number, sqFtPerUnit: { type: Number, default: 0 }, sortOrder: { type: Number, default: 999 }, status: { type: String, default: 'Active' }, createdAt: String }, schemaOptions),
  incoming: new mongoose.Schema({ _id: String, date: String, invoiceNo: String, referenceNo: String, vendorName: String, destinationType: String, destinationSiteId: String, notes: String, items: [{ materialId: String, quantity: Number, rate: Number, amount: Number, unitPrice: Number }], createdAt: String }, schemaOptions),
  outgoing: new mongoose.Schema({ _id: String, date: String, referenceNo: String, ticketNo: String, customerName: String, siteId: String, notes: String, items: [{ materialId: String, quantity: Number, rate: Number, amount: Number }], createdAt: String }, schemaOptions),
  siteUsage: new mongoose.Schema({ _id: String, siteId: String, materialId: String, quantity: Number, date: String, notes: String, createdAt: String }, schemaOptions),
  siteReturns: new mongoose.Schema({ _id: String, siteId: String, materialId: String, quantity: Number, date: String, notes: String, createdAt: String }, schemaOptions),
  siteDamaged: new mongoose.Schema({ _id: String, siteId: String, materialId: String, quantity: Number, date: String, notes: String, createdAt: String }, schemaOptions),
  siteExpenses: new mongoose.Schema({ _id: String, siteId: String, date: String, amount: Number, category: String, description: String, createdAt: String }, schemaOptions),
  sitePayments: new mongoose.Schema({ _id: String, siteId: String, date: String, amount: Number, paymentMode: String, reference: String, notes: String, createdAt: String }, schemaOptions),
  transactions: new mongoose.Schema({ _id: String, materialId: String, materialName: String, quantity: Number, action: String, siteId: String, siteName: String, date: String, user: String, createdAt: String }, schemaOptions),
  rentalSites: new mongoose.Schema({ _id: String, customerName: String, siteName: String, goingDate: String, comingDate: String, status: { type: String, default: 'Active' }, items: [{ materialId: String, quantity: Number, rate: Number }], createdAt: String }, schemaOptions),
  categories: new mongoose.Schema({ _id: String, sortOrder: { type: Number, default: 999 }, createdAt: String }, schemaOptions),
  telegramChats: new mongoose.Schema({ _id: String, name: String, createdAt: String }, schemaOptions),
  smsContacts: new mongoose.Schema({ _id: String, name: String, createdAt: String }, schemaOptions),
  whatsappContacts: new mongoose.Schema({ _id: String, name: String, createdAt: String }, schemaOptions),
  separateBillings: new mongoose.Schema({
    _id: String,
    siteName: String,
    contractorName: String,
    ownerName: String,
    location: String,
    lintelDate: String,
    ratePerSqFt: { type: Number, default: null },
    items: [{
      type: { type: String, default: 'Slab' },
      formula: { type: String, default: 'L * B * Q' },
      materialName: String,
      length: Number,
      breadth: Number,
      quantity: Number,
      area: Number
    }],
    slabArea: { type: Number, default: 0 },
    beamArea: { type: Number, default: 0 },
    openArea: { type: Number, default: 0 },
    grossArea: { type: Number, default: 0 },
    netArea: { type: Number, default: 0 },
    totalArea: { type: Number, default: 0 },
    totalAmount: { type: Number, default: null },
    createdAt: String
  }, schemaOptions),
  labours: new mongoose.Schema({ _id: String, name: String, nickname: String, phone: String, status: { type: String, default: 'Active' }, createdAt: String }, schemaOptions),
  labourLogs: new mongoose.Schema({ _id: String, date: String, labourId: String, siteId: String, attendance: { type: String, enum: ['Present', 'Half Day', 'Absent'] }, dailyWage: { type: Number, default: 0 }, overtime: { type: Number, default: 0 }, moneyGiven: { type: Number, default: 0 }, notes: { type: String, default: '' }, createdAt: String }, schemaOptions),
};


// ─── Models (cached across warm invocations) ──────────────────────
const models = {};
function getModel(name) {
  if (!models[name]) {
    try {
      models[name] = mongoose.model(name);
    } catch {
      const collName = name === 'labourLogs' ? 'labour_logs' : name;
      models[name] = mongoose.model(name, schemas[name], collName);
    }
  }
  return models[name];
}

// ─── DB Connection (reused across warm invocations) ───────────────
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
}

// ─── Helper: send JSON response ───────────────────────────────────
function json(res, status, data) {
  res.status(status).json(data);
}

// ─── Main Handler ─────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();
  } catch (err) {
    return json(res, 500, { error: 'DB connection failed: ' + err.message });
  }

  // Parse URL path directly: /api/sites, /api/sites/123, /api/sites/123/cascade
  const rawPath = decodeURIComponent(req.url.split('?')[0]); // strip query string and decode URI components
  const segments = rawPath.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const collection = segments[0];
  const id = segments[1];
  const action = segments[2]; // e.g. "cascade"

  if (collection === 'telegram-report') {
    function getYesterdayIST() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
      const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString().split('T')[0];
    }

    const dateParam = req.query?.date || new URL(`http://localhost${req.url}`).searchParams.get('date');
    const reportDate = dateParam || getYesterdayIST();

    const reportModels = {
      Material: getModel('materials'),
      Incoming: getModel('incoming'),
      Outgoing: getModel('outgoing'),
      SiteReturns: getModel('siteReturns'),
      RentalSite: getModel('rentalSites'),
      Site: getModel('sites'),
      TelegramChat: getModel('telegramChats'),
      SiteUsage: getModel('siteUsage'),
      SiteDamaged: getModel('siteDamaged')
    };

    if (id === 'preview') {
      try {
        const { generateDailyWarehouseSummary } = require('../server/reportGenerator');
        const pdfBuffer = await generateDailyWarehouseSummary({ date: reportDate, models: reportModels });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="KSS_Warehouse_Summary_${reportDate}.pdf"`);
        return res.status(200).send(pdfBuffer);
      } catch (err) {
        return json(res, 500, { error: 'Failed to generate PDF preview: ' + err.message });
      }
    }

    if (id === 'send') {
      try {
        const { sendTelegramReport } = require('../server/telegramService');
        const result = await sendTelegramReport({ date: reportDate, models: reportModels });
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { error: 'Failed to send Telegram report: ' + err.message });
      }
    }

    return json(res, 400, { error: 'Invalid telegram-report action. Use /preview or /send' });
  }

  if (collection === 'sms-report') {
    function getYesterdayIST() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
      const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString().split('T')[0];
    }

    const dateParam = req.query?.date || new URL(`http://localhost${req.url}`).searchParams.get('date');
    const reportDate = dateParam || getYesterdayIST();

    const reportModels = {
      Material: getModel('materials'),
      Incoming: getModel('incoming'),
      Outgoing: getModel('outgoing'),
      SiteReturns: getModel('siteReturns'),
      RentalSite: getModel('rentalSites'),
      Site: getModel('sites'),
      SmsContact: getModel('smsContacts'),
      SiteUsage: getModel('siteUsage'),
      SiteDamaged: getModel('siteDamaged')
    };

    if (id === 'debug-keys') {
      const mask = (val) => {
        if (!val) return 'undefined/empty';
        const str = String(val).trim();
        if (str.length <= 8) return `defined (len: ${str.length}, value: ${str})`;
        return `defined (len: ${str.length}, first4: "${str.substring(0, 4)}", last4: "${str.substring(str.length - 4)}")`;
      };
      
      const cleanSid = ((process.env.TWILIO_ACCOUNT_SID || '').trim().replace(/['"]+/g, '').match(/AC[a-f0-9]{32}/i) || [])[0] || '';
      const cleanToken = ((process.env.TWILIO_AUTH_TOKEN || '').trim().replace(/['"]+/g, '').match(/[a-f0-9]{32}/i) || [])[0] || '';
      const cleanFrom = ((process.env.TWILIO_FROM_NUMBER || '').trim().replace(/['"]+/g, '').match(/\+?[0-9]{10,15}/) || [])[0] || '';

      return json(res, 200, {
        raw: {
          FAST2SMS_API_KEY: mask(process.env.FAST2SMS_API_KEY),
          TWILIO_ACCOUNT_SID: mask(process.env.TWILIO_ACCOUNT_SID),
          TWILIO_AUTH_TOKEN: mask(process.env.TWILIO_AUTH_TOKEN),
          TWILIO_FROM_NUMBER: mask(process.env.TWILIO_FROM_NUMBER),
          META_ACCESS_TOKEN: mask(process.env.META_ACCESS_TOKEN),
          META_PHONE_NUMBER_ID: mask(process.env.META_PHONE_NUMBER_ID)
        },
        extracted: {
          TWILIO_ACCOUNT_SID: mask(cleanSid),
          TWILIO_AUTH_TOKEN: mask(cleanToken),
          TWILIO_FROM_NUMBER: mask(cleanFrom)
        }
      });
    }

    if (id === 'preview') {
      try {
        const { generateDailyWarehouseSummaryText } = require('../server/smsService');
        const text = await generateDailyWarehouseSummaryText({ date: reportDate, models: reportModels });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(text);
      } catch (err) {
        return json(res, 500, { error: 'Failed to generate SMS preview: ' + err.message });
      }
    }

    if (id === 'send') {
      try {
        const { sendSmsReport } = require('../server/smsService');
        const result = await sendSmsReport({ date: reportDate, models: reportModels });
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { error: 'Failed to send SMS report: ' + err.message });
      }
    }

    return json(res, 400, { error: 'Invalid sms-report action. Use /preview or /send' });
  }

  if (collection === 'whatsapp-report') {
    function getYesterdayIST() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
      const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
      const yesterday = new Date(istTime.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString().split('T')[0];
    }

    const dateParam = req.query?.date || new URL(`http://localhost${req.url}`).searchParams.get('date');
    const reportDate = dateParam || getYesterdayIST();

    const reportModels = {
      Material: getModel('materials'),
      Incoming: getModel('incoming'),
      Outgoing: getModel('outgoing'),
      SiteReturns: getModel('siteReturns'),
      RentalSite: getModel('rentalSites'),
      Site: getModel('sites'),
      WhatsappContact: getModel('whatsappContacts'),
      SiteUsage: getModel('siteUsage'),
      SiteDamaged: getModel('siteDamaged')
    };

    if (id === 'preview') {
      try {
        const { generateDailyWarehouseSummaryWhatsApp } = require('../server/whatsappService');
        const text = await generateDailyWarehouseSummaryWhatsApp({ date: reportDate, models: reportModels });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(text);
      } catch (err) {
        return json(res, 500, { error: 'Failed to generate WhatsApp preview: ' + err.message });
      }
    }

    if (id === 'send') {
      try {
        const { sendWhatsappReport } = require('../server/whatsappService');
        const result = await sendWhatsappReport({ date: reportDate, models: reportModels });
        return json(res, 200, result);
      } catch (err) {
        return json(res, 500, { error: 'Failed to send WhatsApp report: ' + err.message });
      }
    }

    return json(res, 400, { error: 'Invalid whatsapp-report action. Use /preview or /send' });
  }

  if (collection === 'reset-stock') {
    if (req.method === 'POST') {
      try {
        await getModel('incoming').deleteMany({});
        await getModel('outgoing').deleteMany({});
        await getModel('siteReturns').deleteMany({});
        await getModel('siteUsage').deleteMany({});
        await getModel('siteDamaged').deleteMany({});
        await getModel('transactions').deleteMany({});
        return json(res, 200, { message: 'Stock reset completed' });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }
    return json(res, 405, { error: 'Method not allowed' });
  }

  // ---- Custom Labour Module Endpoints ----
  if (collection === 'labours-summary') {
    try {
      const getQueryParam = (name) => {
        if (req.query && req.query[name]) return req.query[name];
        try {
          return new URL(req.url, 'http://localhost').searchParams.get(name);
        } catch { return null; }
      };

      const startDate = getQueryParam('startDate');
      const endDate = getQueryParam('endDate');
      const siteId = getQueryParam('siteId');
      const labourId = getQueryParam('labourId');
      const attendance = getQueryParam('attendance');

      function getTodayIST() {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
        const istTime = new Date(utc + 5.5 * 60 * 60 * 1000);
        return istTime.toISOString().split('T')[0];
      }

      const pipeline = [];

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
                absentDates: []
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
                      // Overtime pay = (dailyWage / 8) * overtimeHours
                      $multiply: [
                        { $divide: [{ $ifNull: ["$$this.dailyWage", 0] }, 8] },
                        { $ifNull: ["$$this.overtimeHours", 0] }
                      ]
                    }
                  ]
                },
                totalOvertimeHours: { $add: ["$$value.totalOvertimeHours", { $ifNull: ["$$this.overtimeHours", 0] }] },
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
          totalEarnings: { $add: ["$stats.grossWages", "$stats.totalOvertime"] }
        }
      });

      pipeline.push({
        $project: {
          name: 1,
          nickname: 1,
          phone: 1,
          status: 1,
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
          payableAmount: {
            $cond: [{ $gt: ["$totalEarnings", "$totalMoneyGiven"] }, { $subtract: ["$totalEarnings", "$totalMoneyGiven"] }, 0]
          },
          advanceBalance: {
            $cond: [{ $gt: ["$totalMoneyGiven", "$totalEarnings"] }, { $subtract: ["$totalMoneyGiven", "$totalEarnings"] }, 0]
          }
        }
      });

      const laboursData = await getModel('labours').aggregate(pipeline);

      const totalLabour = await getModel('labours').countDocuments({});
      const todayStr = getTodayIST();
      const todayLogs = await getModel('labourLogs').find({ date: todayStr });
      const presentToday = todayLogs.filter(l => l.attendance === 'Present').length;
      const halfDayToday = todayLogs.filter(l => l.attendance === 'Half Day').length;
      const absentToday = todayLogs.filter(l => l.attendance === 'Absent').length;

      let overallPayable = 0;
      let overallAdvance = 0;
      laboursData.forEach(l => {
        overallPayable += l.payableAmount;
        overallAdvance += l.advanceBalance;
      });

      return json(res, 200, {
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
      return json(res, 500, { error: err.message });
    }
  }

  if (collection === 'labours' && action === 'logs') {
    try {
      const logs = await getModel('labourLogs').find({ labourId: id }).sort({ date: -1 });
      return json(res, 200, logs);
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (!collection || !schemas[collection]) {
    return json(res, 404, { error: 'Collection not found: ' + collection });
  }

  const Model = getModel(collection);

  try {
    // ── GET all ──────────────────────────────────────────────────
    if (req.method === 'GET' && !id) {
      const items = await Model.find();
      return json(res, 200, items);
    }

    // ── GET by ID ────────────────────────────────────────────────
    if (req.method === 'GET' && id) {
      const item = await Model.findById(id);
      if (!item) return json(res, 404, { error: 'Not found' });
      return json(res, 200, item);
    }

    // ── POST (create) ────────────────────────────────────────────
    if (req.method === 'POST' && !id) {
      const body = req.body;
      if (body.id) body._id = body.id;
      if (!body.createdAt) body.createdAt = new Date().toISOString().split('T')[0];
      const item = new Model(body);
      const saved = await item.save();
      return json(res, 201, saved);
    }

    // ── PUT (update) ─────────────────────────────────────────────
    if (req.method === 'PUT' && id) {
      const body = { ...req.body, _id: id };
      const updated = await Model.findByIdAndUpdate(id, body, { new: true, upsert: true });
      if (!updated) return json(res, 404, { error: 'Not found' });
      return json(res, 200, updated);
    }


    // ── DELETE cascade (sites only) ──────────────────────────────
    if (req.method === 'DELETE' && id && action === 'cascade') {
      await getModel('outgoing').deleteMany({ siteId: id });
      await getModel('incoming').deleteMany({ destinationSiteId: id });
      await getModel('siteReturns').deleteMany({ siteId: id });
      await getModel('siteUsage').deleteMany({ siteId: id });
      await getModel('siteDamaged').deleteMany({ siteId: id });
      await getModel('siteExpenses').deleteMany({ siteId: id });
      await getModel('sitePayments').deleteMany({ siteId: id });
      const deleted = await getModel('sites').findByIdAndDelete(id);
      if (!deleted) return json(res, 404, { error: 'Site not found' });
      return json(res, 200, { message: 'Cascade deleted' });
    }

    // ── DELETE single ────────────────────────────────────────────
    if (req.method === 'DELETE' && id) {
      const deleted = await Model.findByIdAndDelete(id);
      if (!deleted) return json(res, 404, { error: 'Not found' });
      return json(res, 200, { message: 'Deleted' });
    }

    return json(res, 405, { error: 'Method not allowed' });

  } catch (err) {
    return json(res, 400, { error: err.message });
  }
};
