const router = require('express').Router();
const MenuItem = require('../models/MenuItem');
const { adminMiddleware } = require('../middleware/auth');

// GET all available menu items (public)
router.get('/', async (req, res) => {
  try {
    const items = await MenuItem.find({ available: true }).sort({ category: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all items including unavailable (admin only)
router.get('/all', adminMiddleware, async (req, res) => {
  try {
    const items = await MenuItem.find().sort({ category: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD new item (admin only)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { name, desc, price, category, image } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Name, price and category required' });
    const item = await MenuItem.create({ name, desc, price, category, image });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE item (admin only)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE item (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
