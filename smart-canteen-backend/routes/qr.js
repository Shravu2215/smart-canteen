const router = require('express').Router();
const os = require('os');
const QRCode = require('qrcode');
const { adminMiddleware, authMiddleware } = require('../middleware/auth');

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = forwardedProto ? forwardedProto.split(',')[0] : req.protocol || 'http';
  const host = req.headers.host;
  const port = process.env.PORT || 5000;

  const envUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null;
  if (envUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(envUrl)) {
    return envUrl;
  }

  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`;
  }

  const ip = getLocalIPv4();
  return ip ? `${proto}://${ip}:${port}` : `http://localhost:${port}`;
}

// ===== GENERATE QR for a meal (admin views these, prints/displays them) =====
// The QR encodes a URL. When a student scans it with their phone,
// it opens the canteen app URL.
//
// QR URL format: https://YOUR_DOMAIN/scan.html?meal=breakfast
router.get('/generate/:meal', adminMiddleware, async (req, res) => {
  const { meal } = req.params;
  if (!['breakfast', 'lunch', 'dinner'].includes(meal)) {
    return res.status(400).json({ error: 'Invalid meal. Use breakfast, lunch or dinner.' });
  }

  const baseUrl = getBaseUrl(req);
  const scanUrl = `${baseUrl}/scan.html?meal=${meal}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(scanUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
    res.json({ meal, url: scanUrl, qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET all 3 QR codes at once (admin dashboard) =====
router.get('/all', adminMiddleware, async (req, res) => {
  const meals = ['breakfast', 'lunch', 'dinner'];
  const baseUrl = getBaseUrl(req);

  try {
    const result = {};
    for (const meal of meals) {
      const scanUrl = `${baseUrl}/scan.html?meal=${meal}`;
      result[meal] = await QRCode.toDataURL(scanUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
