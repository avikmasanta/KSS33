const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33')
  .then(async () => {
    const db = mongoose.connection.db;
    
    console.log('--- ALL INCOMING (singular) ---');
    console.log(await db.collection('incoming').find({}).toArray());
    
    console.log('--- ALL INCOMINGS (plural) ---');
    console.log(await db.collection('incomings').find({}).toArray());

    console.log('--- ALL MATERIALS ---');
    console.log(await db.collection('materials').find({}).toArray());

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
