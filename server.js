require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== ROUTES =====
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/menu',   require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/meals',  require('./routes/meals'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/qr',     require('./routes/qr'));

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date(), db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ===== CONNECT TO MONGODB =====
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedAdmin();
    const PORT = process.env.PORT || 5000;
    const localIp = Object.values(os.networkInterfaces())
      .flat()
      .find(net => net.family === 'IPv4' && !net.internal)?.address || 'localhost';
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      if (localIp && localIp !== 'localhost') {
        console.log(`🌐 Accessible on your network at http://${localIp}:${PORT}`);
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('👉 Check your MONGODB_URI in .env file');
    process.exit(1);
  });

// ===== SEED ADMIN ON FIRST RUN =====
async function seedAdmin() {
  const Admin = require('./models/Admin');
  const bcrypt = require('bcryptjs');
  const existing = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
  if (!existing) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await Admin.create({ username: process.env.ADMIN_USERNAME, password: hashed });
    console.log(`👤 Admin created: ${process.env.ADMIN_USERNAME} / ${process.env.ADMIN_PASSWORD}`);
  }
}
