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

module.exports = {
  Customer: mongoose.model('Customer', CustomerSchema),
  Site: mongoose.model('Site', SiteSchema),
  Material: mongoose.model('Material', MaterialSchema),
  Incoming: mongoose.model('Incoming', IncomingSchema),
  Outgoing: mongoose.model('Outgoing', OutgoingSchema),
  SiteUsage: mongoose.model('SiteUsage', SiteUsageSchema),
  SiteReturns: mongoose.model('SiteReturns', SiteReturnsSchema),
  SiteDamaged: mongoose.model('SiteDamaged', SiteDamagedSchema),
  SiteExpenses: mongoose.model('SiteExpenses', SiteExpensesSchema),
  SitePayments: mongoose.model('SitePayments', SitePaymentsSchema),
  Transaction: mongoose.model('Transaction', TransactionSchema),
  RentalSite: mongoose.model('RentalSite', RentalSiteSchema),
  Category: mongoose.model('Category', CategorySchema)
};


