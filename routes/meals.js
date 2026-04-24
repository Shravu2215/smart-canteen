const router = require('express').Router();
const MealCheckIn = require('../models/MealCheckIn');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Helper: get today's date string in IST as "YYYY-MM-DD"
function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().slice(0, 10);
}

// ===== CHECKIN without login - for QR scan =====
router.post('/checkin', async (req, res) => {
  const { userName, meal } = req.body;
  if (!userName || !meal) {
    return res.status(400).json({ error: 'Name and meal required' });
  }
  if (!['breakfast', 'lunch', 'dinner'].includes(meal)) {
    return res.status(400).json({ error: 'Invalid meal' });
  }

  const today = todayIST();
  const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);

  try {
    await MealCheckIn.create({
      userName,
      meal,
      date: today,
    });
    res.json({ success: true, message: `${mealLabel} checked in for ${userName}` });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: `${userName} already checked in for ${mealLabel} today.` });
    }
    res.status(500).json({ error: err.message });
  }
});

// ===== GET today's meal check-ins (admin) =====
router.get('/today', adminMiddleware, async (req, res) => {
  try {
    const today = todayIST();
    const checkins = await MealCheckIn.find({ date: today }).sort({ scannedAt: -1 });
    res.json(checkins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET check-in stats for a date (admin) =====
router.get('/stats/:date', adminMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const stats = await MealCheckIn.aggregate([
      { $match: { date } },
      { $group: { _id: '$meal', count: { $sum: 1 } } }
    ]);
    const result = { breakfast: 0, lunch: 0, dinner: 0 };
    stats.forEach(s => { result[s._id] = s.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
