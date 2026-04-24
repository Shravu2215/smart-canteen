const router = require('express').Router();
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const MealCheckIn = require('../models/MealCheckIn');
const { adminMiddleware } = require('../middleware/auth');

// GET dashboard stats
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);

    const [todayOrders, totalUsers, totalMenuItems, todayRevenue, mealStats] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      User.countDocuments(),
      MenuItem.countDocuments({ available: true }),
      Order.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      MealCheckIn.aggregate([
        { $match: { date: new Date().toISOString().slice(0,10) } },
        { $group: { _id: '$meal', count: { $sum: 1 } } }
      ]),
    ]);

    const meals = { breakfast: 0, lunch: 0, dinner: 0 };
    mealStats.forEach(m => { meals[m._id] = m.count; });

    res.json({
      todayOrders,
      totalUsers,
      totalMenuItems,
      todayRevenue: todayRevenue[0]?.total || 0,
      meals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET hostel students list
router.get('/hostel-students', adminMiddleware, async (req, res) => {
  try {
    const students = await User.find({ isHostel: true }).select('-password');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD hostel student (admin adds them manually)
router.post('/hostel-students', adminMiddleware, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { name, messId, phone, password } = req.body;
    if (!name || !messId || !phone || !password) return res.status(400).json({ error: 'All fields required' });
    const exists = await User.findOne({ $or: [{ phone }, { messId }] });
    if (exists) return res.status(400).json({ error: 'Phone or Mess ID already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, messId, phone, password: hashed, isHostel: true, role: 'student' });
    res.status(201).json({ id: user._id, name: user.name, messId: user.messId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
