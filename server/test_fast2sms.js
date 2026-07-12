require('dotenv').config();
const mongoose = require('mongoose');
const models = require('./models');
const smsService = require('./smsService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    console.log('--- Triggering SMS Send via Fast2SMS ---');
    const result = await smsService.sendSmsReport({
      date: '2026-07-11',
      models
    });
    console.log('Fast2SMS Send Result:', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}
run();
