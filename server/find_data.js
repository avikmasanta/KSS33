const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33')
  .then(async () => {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      const docsStr = JSON.stringify(docs);
      if (docsStr.includes('1300') || docsStr.includes('1330') || docsStr.includes('2500') || docsStr.includes('2530') || docsStr.includes('2510')) {
        console.log(`Found matching number in collection: ${col.name}`);
        docs.forEach(doc => {
          const docStr = JSON.stringify(doc);
          if (docStr.includes('1300') || docStr.includes('1330') || docStr.includes('2500') || docStr.includes('2530') || docStr.includes('2510')) {
            console.log(' - Match doc:', JSON.stringify(doc));
          }
        });
      }
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
