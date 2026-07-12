const mongoose = require('mongoose');
require('dotenv').config();

const models = require('./models');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kss33')
  .then(async () => {
    const Material = models.Material;
    const Incoming = models.Incoming;
    const Outgoing = models.Outgoing;
    const SiteReturns = models.SiteReturns;
    const RentalSite = models.RentalSite;
    const SiteUsage = models.SiteUsage;
    const SiteDamaged = models.SiteDamaged;

    const mId = 'mat_shut_2x4'; // Steel Plate 2'x4'
    const material = await Material.findById(mId);
    console.log('Material:', material.name);

    let totalPurchased = 0;
    let totalReturned = 0;

    const allIncoming = await Incoming.find({});
    allIncoming.filter(r => r.destinationType === 'warehouse').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          const qty = parseFloat(i.quantity) || 0;
          if (r.supplier && r.supplier.toLowerCase().includes('return')) {
            totalReturned += qty;
          } else {
            totalPurchased += qty;
          }
        }
      });
    });
    console.log('Incoming (Purchased):', totalPurchased);
    console.log('Incoming (Returned via supplier):', totalReturned);

    const allReturns = await SiteReturns.find({});
    let totalReturnsColl = 0;
    allReturns.forEach(r => {
      if (String(r.materialId) === mId) {
        totalReturnsColl += parseFloat(r.quantity) || 0;
      }
    });
    console.log('SiteReturns collection total:', totalReturnsColl);

    const allOutgoing = await Outgoing.find({});
    let totalSent = 0;
    allOutgoing.forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          totalSent += parseFloat(i.quantity) || 0;
        }
      });
    });
    console.log('Outgoing (totalSent):', totalSent);

    const allRentals = await RentalSite.find({});
    let totalRented = 0;
    allRentals.filter(r => r.status === 'Active').forEach(r => {
      (r.items || []).forEach(i => {
        if (String(i.materialId) === mId) {
          totalRented += parseFloat(i.quantity) || 0;
        }
      });
    });
    console.log('RentalSite (Active rented):', totalRented);

    const warehouseStock = (totalPurchased + totalReturned + totalReturnsColl) - totalSent - totalRented;
    console.log('Warehouse Stock calculated as (Purchased + Returned + SiteReturns) - Sent - Rented =', warehouseStock);

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
