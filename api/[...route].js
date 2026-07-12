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
};


// ─── Models (cached across warm invocations) ──────────────────────
const models = {};
function getModel(name) {
  if (!models[name]) {
    try {
      models[name] = mongoose.model(name);
    } catch {
      models[name] = mongoose.model(name, schemas[name], name);
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
  const rawPath = req.url.split('?')[0]; // strip query string
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
      return json(res, 200, {
        FAST2SMS_API_KEY: mask(process.env.FAST2SMS_API_KEY),
        TWILIO_ACCOUNT_SID: mask(process.env.TWILIO_ACCOUNT_SID),
        TWILIO_AUTH_TOKEN: mask(process.env.TWILIO_AUTH_TOKEN),
        TWILIO_FROM_NUMBER: mask(process.env.TWILIO_FROM_NUMBER)
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
