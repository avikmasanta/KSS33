// One-time migration: Delete old materials and add new ones via MongoDB directly
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://visionvibes2004_db_user:Bankura%40123@cluster0.zf1ys3x.mongodb.net/kss33?retryWrites=true&w=majority&appName=Cluster0';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  const db = mongoose.connection.db;
  const materialsCol = db.collection('materials');

  // 1. Delete all existing materials
  const deleteResult = await materialsCol.deleteMany({});
  console.log(`Deleted ${deleteResult.deletedCount} old materials`);

  // 2. Insert new materials
  const newMaterials = [
    { _id: 'mat_shut_2x4', name: "Shuttering plate 2'x4'", sku: 'SHUT-2x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_shut_18x4', name: "Shuttering plate 18\"x4'", sku: 'SHUT-18x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_shut_15x4', name: "Shuttering plate 15\"x4'", sku: 'SHUT-15x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_shut_12x4', name: "Shuttering plate 12\"x4'", sku: 'SHUT-12x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_shut_9x4', name: "Shuttering plate 9\"x4'", sku: 'SHUT-9x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_shut_6x4', name: "Shuttering plate 6\"x4'", sku: 'SHUT-6x4', category: 'Shuttering plate', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_channels', name: 'Channels', sku: 'CHAN', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_balli', name: 'Balli', sku: 'BAL', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_props', name: 'Props', sku: 'PROP', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_pipe', name: 'Pipe', sku: 'PIPE', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_ledger', name: 'Ledger', sku: 'LEDG', category: 'Scaffolding', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] },
    { _id: 'mat_misc', name: 'Miscellaneous', sku: 'MISC', category: 'General', unit: 'Nos', unitPrice: 0, reorderLevel: 50, status: 'Active', createdAt: new Date().toISOString().split('T')[0] }
  ];

  const insertResult = await materialsCol.insertMany(newMaterials);
  console.log(`Inserted ${insertResult.insertedCount} new materials`);

  // 3. Verify
  const all = await materialsCol.find({}).toArray();
  console.log(`\nDatabase now has ${all.length} materials:`);
  all.forEach((m, i) => console.log(`  ${i+1}. ${m.name} [${m.category}] (ID: ${m._id})`));

  await mongoose.disconnect();
  console.log('\nDone! Disconnected.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
