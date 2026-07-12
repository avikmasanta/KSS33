require('dotenv').config();
const mongoose = require('mongoose');
const models = require('./models');
const { generateDailyWarehouseSummaryText } = require('./smsService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33';

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // Let's print out the current sites
    const sites = await models.Site.find({});
    console.log('\n--- SITES IN DB ---');
    sites.forEach(s => {
      console.log(`- ID: ${s._id}, Name: ${s.name}, Status: ${s.status}, Lintel Date: ${s.lintelDate || 'None'}`);
    });

    // Test with date 2026-07-12
    console.log('\n--- Generated SMS Report for 2026-07-12 ---');
    const text1 = await generateDailyWarehouseSummaryText({
      date: '2026-07-12',
      models
    });
    console.log(text1);

    // Test with date 2026-07-15 (T1 should cross 12 days: 2026-07-15 - 2026-07-02 = 13 days + 1 = 14 days > 12)
    console.log('\n--- Generated SMS Report for 2026-07-15 ---');
    const text2 = await generateDailyWarehouseSummaryText({
      date: '2026-07-15',
      models
    });
    console.log(text2);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

test();
