const express = require('express');
const router = express.Router();
const models = require('./models');

// Generic CRUD factory
function createCrudRoutes(modelName, Model) {
  const r = express.Router();

  // Get all
  r.get('/', async (req, res) => {
    try {
      const items = await Model.find();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get by ID
  r.get('/:id', async (req, res) => {
    try {
      const item = await Model.findById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create
  r.post('/', async (req, res) => {
    try {
      if (!req.body.createdAt) req.body.createdAt = new Date().toISOString().split('T')[0];
      const newItem = new Model(req.body);
      const saved = await newItem.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update
  r.put('/:id', async (req, res) => {
    try {
      const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) return res.status(404).json({ error: 'Not found' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete
  r.delete('/:id', async (req, res) => {
    try {
      const deleted = await Model.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return r;
}

router.use('/customers', createCrudRoutes('Customer', models.Customer));
router.use('/sites', createCrudRoutes('Site', models.Site));
router.use('/materials', createCrudRoutes('Material', models.Material));
router.use('/incoming', createCrudRoutes('Incoming', models.Incoming));
router.use('/outgoing', createCrudRoutes('Outgoing', models.Outgoing));
router.use('/siteUsage', createCrudRoutes('SiteUsage', models.SiteUsage));
router.use('/siteReturns', createCrudRoutes('SiteReturns', models.SiteReturns));
router.use('/siteDamaged', createCrudRoutes('SiteDamaged', models.SiteDamaged));
router.use('/siteExpenses', createCrudRoutes('SiteExpenses', models.SiteExpenses));
router.use('/sitePayments', createCrudRoutes('SitePayments', models.SitePayments));

// Special Cascade Delete for Sites
router.delete('/sites/:id/cascade', async (req, res) => {
  const id = req.params.id;
  try {
    await models.Outgoing.deleteMany({ siteId: id });
    await models.Incoming.deleteMany({ destinationType: 'site', destinationSiteId: id });
    await models.SiteReturns.deleteMany({ siteId: id });
    await models.SiteUsage.deleteMany({ siteId: id });
    await models.SiteDamaged.deleteMany({ siteId: id });
    await models.SiteExpenses.deleteMany({ siteId: id });
    await models.SitePayments.deleteMany({ siteId: id });
    const deleted = await models.Site.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Site not found' });
    res.json({ message: 'Cascade deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
