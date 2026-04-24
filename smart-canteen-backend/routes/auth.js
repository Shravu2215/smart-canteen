const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

// ===== STUDENT / FACULTY SIGNUP =====
router.post('/signup', async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: 'All fields required' });
    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ error: 'Phone number already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone, password: hashed, role: role || 'student' });
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== STUDENT / FACULTY LOGIN =====
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: 'Phone number not registered' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role, isHostel: user.isHostel }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, isHostel: user.isHostel } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== HOSTEL LOGIN (via Mess ID) =====
router.post('/hostel-login', async (req, res) => {
  try {
    const { messId, password } = req.body;
    if (!messId || !password) return res.status(400).json({ error: 'Mess ID and password required' });
    const user = await User.findOne({ messId, isHostel: true });
    if (!user) return res.status(400).json({ error: 'Mess ID not found' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });
    const token = jwt.sign({ id: user._id, name: user.name, role: 'hostel', messId: user.messId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, messId: user.messId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADMIN LOGIN =====
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ error: 'Admin not found' });
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });
    const token = jwt.sign({ id: admin._id, username: admin.username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, admin: { id: admin._id, username: admin.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
