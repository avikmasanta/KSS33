require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const models = require('./models');
const { sendWhatsappReport } = require('./whatsappService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kss33';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    const date = '2026-07-12';
    console.log(`--- Triggering WhatsApp Send for date: ${date} ---`);
    
    // Ensure we have a mock recipient in DB for testing
    let contact = await models.WhatsappContact.findById('+918391828260');
    if (!contact) {
      contact = new models.WhatsappContact({
        _id: '+918391828260',
        name: 'Test Recipient',
        createdAt: new Date().toISOString()
      });
      await contact.save();
    }

    const result = await sendWhatsappReport({ date, models });
    console.log('WhatsApp Send Result:', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
