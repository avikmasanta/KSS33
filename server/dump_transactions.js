const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33')
  .then(async () => {
    const db = mongoose.connection.db;
    console.log('--- TRANSACTIONS ---');
    console.log(await db.collection('transactions').find({}).toArray());
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
