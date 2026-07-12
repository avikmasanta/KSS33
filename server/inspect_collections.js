const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33')
  .then(async () => {
    const db = mongoose.connection.db;
    
    console.log('--- OUTGOING (singular) ---');
    const out = await db.collection('outgoing').find({}).toArray();
    console.log(out.length, 'records');
    if (out.length) console.log(JSON.stringify(out[0]));
    
    console.log('--- OUTGOINGS (plural) ---');
    const outs = await db.collection('outgoings').find({}).toArray();
    console.log(outs.length, 'records');
    if (outs.length) console.log(JSON.stringify(outs[0]));
    
    console.log('--- SITERETURNS (camelCase) ---');
    const srcc = await db.collection('siteReturns').find({}).toArray();
    console.log(srcc.length, 'records');
    if (srcc.length) console.log(JSON.stringify(srcc[0]));
    
    console.log('--- SITERETURNS (lowercase) ---');
    const srlw = await db.collection('sitereturns').find({}).toArray();
    console.log(srlw.length, 'records');
    if (srlw.length) console.log(JSON.stringify(srlw[0]));
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
