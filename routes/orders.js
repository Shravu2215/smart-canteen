const router = require('express').Router();
const Order = require('../models/Order');
const MealCheckIn = require('../models/MealCheckIn');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// PLACE order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, total, paymentMethod, meal } = req.body;
    if (!items || !items.length || !total || !paymentMethod) {
      return res.status(400).json({ error: 'Missing order details' });
    }
    const order = await Order.create({
      userId: req.user.id,
      userName: req.user.name,
      meal, // track which meal this order is for
      items,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid',
    });
    // Mark meal as "ordered" in check-ins
    if (meal) {
      const today = new Date().toISOString().slice(0, 10);
      await MealCheckIn.updateOne(
        { userName: req.user.name, meal, date: today },
        { orderStatus: 'ordered' }
      );
    }
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET my orders
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all orders (admin)
router.get('/all', adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET today's orders (admin)
router.get('/today', adminMiddleware, async (req, res) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE order status (admin)
router.patch('/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // When order is collected, mark meal as "completed" in check-ins
    if (orderStatus === 'collected' && order.meal) {
      const today = new Date().toISOString().slice(0, 10);
      await MealCheckIn.updateOne(
        { userName: order.userName, meal: order.meal, date: today },
        { orderStatus: 'completed' }
      );
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
