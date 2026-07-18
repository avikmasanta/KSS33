const mongoose = require('mongoose');

// Base options for JSON serialization to map _id to id and remove __v
const schemaOptions = {
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
};

const CustomerSchema = new mongoose.Schema({
  _id: String,
  name: String,
  email: String,
  phone: String,
  address: String,
  gst: String,
  status: { type: String, default: 'Active' },
  createdAt: String
}, schemaOptions);

const SiteSchema = new mongoose.Schema({
  _id: String,
  customerId: String,
  name: String,
  customerName: String,
  gstNumber: String,
  contactNumber: String,
  status: { type: String, default: 'Active' },
  startDate: String,
  address: String,
  budget: Number,
  ratePerSqFt: Number,
  tokenNumber: String,
  lintelDate: String,
  archivedAt: String,
  notes: { type: String, default: '' },
  createdAt: String
}, schemaOptions);

const MaterialSchema = new mongoose.Schema({
  _id: String,
  name: String,
  sku: String,
  category: String,
  unit: String,
  unitPrice: Number,
  reorderLevel: Number,
  sqFtPerUnit: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 999 },
  status: { type: String, default: 'Active' },
  createdAt: String
}, schemaOptions);


const IncomingSchema = new mongoose.Schema({
  _id: String,
  date: String,
  invoiceNo: String,
  referenceNo: String,
  vendorName: String,
  destinationType: String, // 'warehouse' or 'site'
  destinationSiteId: String,
  notes: String,
  items: [{
    materialId: String,
    quantity: Number,
    rate: Number,
    amount: Number,
    unitPrice: Number
  }],
  createdAt: String
}, schemaOptions);

const OutgoingSchema = new mongoose.Schema({
  _id: String,
  date: String,
  referenceNo: String,
  ticketNo: String,
  customerName: String,
  siteId: String,
  notes: String,
  items: [{
    materialId: String,
    quantity: Number,
    rate: Number,
    amount: Number
  }],
  createdAt: String
}, schemaOptions);

const SiteUsageSchema = new mongoose.Schema({
  _id: String,
  siteId: String,
  materialId: String,
  quantity: Number,
  date: String,
  notes: String,
  createdAt: String
}, schemaOptions);

const SiteReturnsSchema = new mongoose.Schema({
  _id: String,
  siteId: String,
  materialId: String,
  quantity: Number,
  date: String,
  notes: String,
  createdAt: String
}, schemaOptions);

const SiteDamagedSchema = new mongoose.Schema({
  _id: String,
  siteId: String,
  materialId: String,
  quantity: Number,
  date: String,
  notes: String,
  createdAt: String
}, schemaOptions);

const SiteExpensesSchema = new mongoose.Schema({
  _id: String,
  siteId: String,
  date: String,
  amount: Number,
  category: String,
  description: String,
  createdAt: String
}, schemaOptions);

const SitePaymentsSchema = new mongoose.Schema({
  _id: String,
  siteId: String,
  date: String,
  amount: Number,
  paymentMode: String,
  reference: String,
  notes: String,
  createdAt: String
}, schemaOptions);

const TransactionSchema = new mongoose.Schema({
  _id: String,
  materialId: String,
  materialName: String,
  quantity: Number,
  action: String, // 'Add', 'Deduct', 'Dispatch', 'Return'
  siteId: String,
  siteName: String,
  date: String,
  user: String,
  createdAt: String
}, schemaOptions);

const RentalSiteSchema = new mongoose.Schema({
  _id: String,
  customerName: String,
  siteName: String,
  goingDate: String,
  comingDate: String,
  status: { type: String, default: 'Active' },
  items: [{
    materialId: String,
    quantity: Number,
    rate: Number
  }],
  createdAt: String
}, schemaOptions);

const CategorySchema = new mongoose.Schema({
  _id: String, // Category Name (e.g. 'Steel Plate')
  sortOrder: { type: Number, default: 999 },
  createdAt: String
}, schemaOptions);

const TelegramChatSchema = new mongoose.Schema({
  _id: String, // Chat ID
  name: String, // Chat name/label
  createdAt: String
}, schemaOptions);

const SmsContactSchema = new mongoose.Schema({
  _id: String, // Phone Number
  name: String, // Contact name/label
  createdAt: String
}, schemaOptions);

const WhatsappContactSchema = new mongoose.Schema({
  _id: String, // Phone Number
  name: String, // Contact name/label
  createdAt: String
}, schemaOptions);

// ── Separate Billing (Fully Independent Module) ──────────────────────────────
const SeparateBillingSchema = new mongoose.Schema({
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
}, schemaOptions);

// -- Labour Module Schemas --
const LabourSchema = new mongoose.Schema({
  _id: String,
  name: String,
  nickname: String,
  phone: String,
  status: { type: String, default: 'Active' },
  defaultWage: { type: Number, default: 500 }, // Persists daily wage rate for this labour
  createdAt: String
}, schemaOptions);

const LabourLogSchema = new mongoose.Schema({
  _id: String,
  date: String,
  labourId: String,
  siteId: String, // optional site assignment
  attendance: { type: String, enum: ['Present', 'Half Day', 'Absent'] },
  dailyWage: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },  // Hours of overtime worked that day
  overtimeTime: { type: String, default: '' },   // Written time slots e.g. "8pm-10pm, 6am-7am"
  overtime: { type: Number, default: 0 },        // Legacy: kept for backward compat, now derived from hours
  moneyGiven: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  createdAt: String
}, schemaOptions);

module.exports = {
  Customer: mongoose.model('Customer', CustomerSchema, 'customers'),
  Site: mongoose.model('Site', SiteSchema, 'sites'),
  Material: mongoose.model('Material', MaterialSchema, 'materials'),
  Incoming: mongoose.model('Incoming', IncomingSchema, 'incoming'),
  Outgoing: mongoose.model('Outgoing', OutgoingSchema, 'outgoing'),
  SiteUsage: mongoose.model('SiteUsage', SiteUsageSchema, 'siteUsage'),
  SiteReturns: mongoose.model('SiteReturns', SiteReturnsSchema, 'siteReturns'),
  SiteDamaged: mongoose.model('SiteDamaged', SiteDamagedSchema, 'siteDamaged'),
  SiteExpenses: mongoose.model('SiteExpenses', SiteExpensesSchema, 'siteExpenses'),
  SitePayments: mongoose.model('SitePayments', SitePaymentsSchema, 'sitePayments'),
  Transaction: mongoose.model('Transaction', TransactionSchema, 'transactions'),
  RentalSite: mongoose.model('RentalSite', RentalSiteSchema, 'rentalSites'),
  Category: mongoose.model('Category', CategorySchema, 'categories'),
  TelegramChat: mongoose.model('TelegramChat', TelegramChatSchema, 'telegramChats'),
  SmsContact: mongoose.model('SmsContact', SmsContactSchema, 'smsContacts'),
  WhatsappContact: mongoose.model('WhatsappContact', WhatsappContactSchema, 'whatsappContacts'),
  SeparateBilling: mongoose.model('SeparateBilling', SeparateBillingSchema, 'separate_billings'),
  Labour: mongoose.model('Labour', LabourSchema, 'labours'),
  LabourLog: mongoose.model('LabourLog', LabourLogSchema, 'labour_logs')
};



