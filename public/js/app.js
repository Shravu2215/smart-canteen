// ===== API CONFIG =====
// Use the same host where the app is served so mobile devices can access it.
const API_BASE = window.location.origin;

// API helper
async function apiCall(path, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('canteen_token');
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Menu items loaded from backend (not hardcoded)
let menuItems = [];

// ===== STATE =====
let cart = [];
let selectedPayment = null;
let currentUser = { name: 'Student', role: 'student' };

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById(id);
  if (s) {
    s.classList.add('active');
    s.scrollTop = 0;
  }
  if (id === 'screen-menu') renderMenu('all');
  if (id === 'screen-cart') renderCart();
  if (id === 'screen-payment') renderPayment();
  if (id === 'screen-admin') renderAdminMenu();
}

// ===== APP STARTUP — connect to real backend =====
window.onload = async function () {
  const status = document.getElementById('loading-status');

  // Check if already logged in
  const token = localStorage.getItem('canteen_token');
  const role  = localStorage.getItem('canteen_role');

  try {
    status.textContent = 'Connecting to server...';
    await fetch(API_BASE + '/api/health');
    status.textContent = 'Loading menu...';
    await loadMenuFromAPI();
    status.textContent = 'Ready!';
    await new Promise(r => setTimeout(r, 400));

    // Auto-login if token exists
    if (token && role === 'hostel') {
      const user = JSON.parse(localStorage.getItem('canteen_user') || '{}');
      currentUser = user;
      document.getElementById('hostel-username').textContent = user.name || user.messId || 'Student';
      showScreen('screen-hostel-checkin');
    } else if (token && role === 'student') {
      const user = JSON.parse(localStorage.getItem('canteen_user') || '{}');
      currentUser = user;
      document.getElementById('menu-username').textContent = user.name || 'Student';
      showScreen('screen-menu');
      checkPendingScan();
    } else {
      showScreen('screen-login');
    }
  } catch (err) {
    document.querySelector('.spinner').classList.add('hidden');
    status.classList.add('hidden');
    document.getElementById('loading-error').classList.remove('hidden');
  }
};

async function loadMenuFromAPI() {
  try {
    const items = await apiCall('/api/menu', 'GET', null, false);
    // Normalise _id → id for compatibility with cart logic
    menuItems = items.map(i => ({ ...i, id: i._id }));
  } catch (e) {
    console.warn('Could not load menu from API:', e.message);
    menuItems = [];
  }
}

// Check if user scanned a QR before logging in
function checkPendingScan() {
  const pending = localStorage.getItem('pending_scan');
  if (pending) {
    localStorage.removeItem('pending_scan');
    window.location.href = API_BASE + '/scan.html?meal=' + pending;
  }
}

// ===== AUTH =====
async function studentLogin() {
  const phone = document.getElementById('student-phone').value.trim();
  const pw    = document.getElementById('student-password').value.trim();
  if (!phone || !pw) return showFormError('Please enter phone and password.');
  try {
    const res = await apiCall('/api/auth/login', 'POST', { phone, password: pw }, false);
    localStorage.setItem('canteen_token', res.token);
    localStorage.setItem('canteen_role',  res.user.role);
    localStorage.setItem('canteen_user',  JSON.stringify(res.user));
    currentUser = res.user;
    document.getElementById('menu-username').textContent = res.user.name;
    showScreen('screen-menu');
    checkPendingScan();
  } catch (e) { showFormError(e.message); }
}

async function studentSignup() {
  const name  = document.querySelector('#screen-signup input[type=text]').value.trim();
  const phone = document.querySelector('#screen-signup input[type=tel]').value.trim();
  const role  = document.querySelector('#screen-signup select').value;
  const pw    = document.querySelector('#screen-signup input[type=password]').value.trim();
  if (!name || !phone || !pw) return showFormError('All fields are required.');
  try {
    const res = await apiCall('/api/auth/signup', 'POST', { name, phone, password: pw, role }, false);
    localStorage.setItem('canteen_token', res.token);
    localStorage.setItem('canteen_role',  res.user.role);
    localStorage.setItem('canteen_user',  JSON.stringify(res.user));
    currentUser = res.user;
    document.getElementById('menu-username').textContent = res.user.name;
    showScreen('screen-menu');
  } catch (e) { showFormError(e.message); }
}

async function hostelLogin() {
  const messId = document.getElementById('mess-id').value.trim();
  const pw     = document.getElementById('hostel-password').value.trim();
  if (!messId || !pw) return showFormError('Please enter Mess ID and password.');
  try {
    const res = await apiCall('/api/auth/hostel-login', 'POST', { messId, password: pw }, false);
    localStorage.setItem('canteen_token', res.token);
    localStorage.setItem('canteen_role',  'hostel');
    localStorage.setItem('canteen_user',  JSON.stringify(res.user));
    currentUser = res.user;
    document.getElementById('hostel-username').textContent = res.user.name;
    showScreen('screen-hostel-checkin');
  } catch (e) { showFormError(e.message); }
}

function adminLogin() {
  // Admin uses the separate /admin.html page served by the backend
  window.location.href = API_BASE + '/admin.html';
}

function showFormError(msg) {
  // Simple inline error — could be improved with per-screen alerts
  alert(msg);
}

// ===== MENU RENDERING =====
function filterMenu(cat, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderMenu(cat);
}

function renderMenu(cat) {
  const grid = document.getElementById('menu-grid');
  const items = cat === 'all' ? menuItems : menuItems.filter(i => i.category === cat);
  grid.innerHTML = items.map(item => {
    const cartItem = cart.find(c => c.id === item.id);
    const qty = cartItem ? cartItem.qty : 0;
    return `
      <div class="menu-card" id="card-${item.id}">
        <img class="menu-card-img" src="${item.image}" alt="${item.name}"
          onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80'"/>
        <div class="menu-card-body">
          <span class="cat-label cat-${item.category}">${capitalize(item.category)}</span>
          <div class="menu-card-name">${item.name}</div>
          <div class="menu-card-desc">${item.desc}</div>
          <div class="menu-card-footer">
            <span class="menu-card-price">₹${item.price}</span>
            ${qty === 0
              ? `<button class="add-btn" onclick="addToCart(${JSON.stringify(item).replace(/"/g,'&quot;')})"><i class="fa-solid fa-plus"></i></button>`
              : `<div class="qty-control">
                  <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
                  <span class="qty-num">${qty}</span>
                  <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
                </div>`
            }
          </div>
        </div>
      </div>`;
  }).join('');
}

// ===== CART LOGIC =====
function addToCart(item) {
  const existing = cart.find(c => c.id === item.id);
  if (existing) existing.qty++;
  else cart.push({ ...item, qty: 1 });
  updateCartBadge();
  // Re-render menu to update qty controls
  const tabs = document.querySelector('.tab.active');
  const cat = tabs ? tabs.textContent.trim().toLowerCase() : 'all';
  renderMenu(cat === 'all' ? 'all' : cat.includes('break') ? 'breakfast' : cat.includes('lunch') ? 'lunch' : 'snacks');
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  updateCartBadge();
  const tabs = document.querySelector('.tab.active');
  const cat = tabs ? tabs.getAttribute('onclick') : '';
  renderMenu(cat.includes('breakfast') ? 'breakfast' : cat.includes('lunch') ? 'lunch' : cat.includes('snacks') ? 'snacks' : 'all');
}

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const amount = cart.reduce((s, i) => s + i.qty * i.price, 0);
  document.getElementById('cart-count-badge').textContent = total;
  document.getElementById('cart-total-badge').textContent = `₹${amount}`;
}

function renderCart() {
  const body = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');

  if (cart.length === 0) {
    body.innerHTML = `<div class="cart-empty">
      <i class="fa-solid fa-cart-shopping"></i>
      <h3>Your cart is empty</h3>
      <p>Browse the menu and add items to get started</p>
    </div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  body.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}"
        onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80'"/>
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <span>₹${item.price} each</span>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="cartChangeQty('${item.id}',-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="cartChangeQty('${item.id}',1)">+</button>
      </div>
      <span class="cart-item-price">₹${item.qty * item.price}</span>
      <button class="remove-btn" onclick="removeFromCart('${item.id}')"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  document.getElementById('cart-subtotal').textContent = `₹${total}`;
}

function cartChangeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  updateCartBadge();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  updateCartBadge();
  renderCart();
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm('Clear all items from cart?')) {
    cart = [];
    updateCartBadge();
    renderCart();
  }
}

// ===== PAYMENT =====
let selectedUpiApp = null;

function renderPayment() {
  const itemsEl = document.getElementById('payment-items');
  itemsEl.innerHTML = cart.map(i => `
    <div class="summary-row">
      <span>${i.name} × ${i.qty}</span>
      <span>₹${i.qty * i.price}</span>
    </div>`).join('');
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  document.getElementById('payment-total').textContent = `₹${total}`;
  selectedPayment = null;
  selectedUpiApp = null;
  document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
}

function selectPayment(method) {
  selectedPayment = method;
  document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
  document.getElementById(`pay-${method}`).classList.add('selected');
}

function placeOrder() {
  if (!selectedPayment) return alert('Please select a payment method.');
  if (selectedPayment === 'upi') {
    // Show UPI app picker instead of placing order directly
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
    document.getElementById('upi-amount-display').textContent = `₹${total}`;
    document.getElementById('modal-upi').classList.remove('hidden');
    return;
  }
  // Cash — finalize directly
  finalizeOrder('Cash on Pickup');
}

// UPI app deep links (standard UPI intent URLs)
const upiApps = {
  gpay:    { name: 'Google Pay',  scheme: 'tez://upi/pay'      },
  phonepe: { name: 'PhonePe',     scheme: 'phonepe://pay'      },
  paytm:   { name: 'Paytm',       scheme: 'paytmmp://pay'      },
  bhim:    { name: 'BHIM',        scheme: 'upi://pay'          },
  amazon:  { name: 'Amazon Pay',  scheme: 'amazonapp://pay'    },
  other:   { name: 'UPI App',     scheme: 'upi://pay'          },
};

// IMPORTANT: Replace this with your canteen's actual UPI VPA (e.g. canteen@okaxis)
const CANTEEN_UPI_VPA = 'pccoercanteen@upi';
const CANTEEN_NAME    = 'PCCOER Canteen';

function openUpiApp(appKey) {
  const app = upiApps[appKey];
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  selectedUpiApp = app.name;

  // Build standard UPI deep link
  const upiParams = new URLSearchParams({
    pa: CANTEEN_UPI_VPA,
    pn: CANTEEN_NAME,
    am: total.toFixed(2),
    cu: 'INR',
    tn: 'PCCOER Canteen Order',
  });

  // Try to open the UPI app
  const upiUrl = `${app.scheme}?${upiParams.toString()}`;
  window.location.href = upiUrl;

  // After a short delay, assume app opened and show confirm screen
  setTimeout(() => {
    document.getElementById('modal-upi').classList.add('hidden');
    document.getElementById('upi-app-name-label').textContent = `Opened in ${app.name}`;
    document.getElementById('modal-upi-confirm').classList.remove('hidden');
  }, 800);
}

function closeUpiModal() {
  document.getElementById('modal-upi').classList.add('hidden');
}

function confirmUpiPayment() {
  // User confirms they paid — finalize order
  document.getElementById('modal-upi-confirm').classList.add('hidden');
  finalizeOrder(`UPI · ${selectedUpiApp || 'Online'}`);
}

function cancelUpiPayment() {
  document.getElementById('modal-upi-confirm').classList.add('hidden');
  selectedUpiApp = null;
}

async function finalizeOrder(methodLabel) {
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const now   = new Date();
  let orderId = '#' + Math.floor(1000 + Math.random() * 9000);

  // Save order to MongoDB
  try {
    const orderPayload = {
      items: cart.map(i => ({ menuItemId: i._id || i.id, name: i.name, price: i.price, qty: i.qty })),
      total,
      paymentMethod: selectedPayment || 'cash',
    };
    const saved = await apiCall('/api/orders', 'POST', orderPayload);
    if (saved.orderId) orderId = saved.orderId;
  } catch (e) {
    console.warn('Could not save order to DB:', e.message);
    // Still show receipt — don't block the user
  }

  document.getElementById('receipt-items').innerHTML = cart.map(i => `
    <div class="receipt-item">
      <span>${i.name} × ${i.qty}</span>
      <span>₹${i.qty * i.price}</span>
    </div>`).join('');
  document.getElementById('receipt-total').textContent = `₹${total}`;
  document.getElementById('receipt-order-id').textContent = `Order ID: ${orderId}`;
  document.getElementById('receipt-time').textContent = `Time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  document.getElementById('receipt-method').textContent = `Payment: ${methodLabel}`;

  showScreen('screen-receipt');
}

function resetOrder() {
  cart = [];
  selectedPayment = null;
  updateCartBadge();
  showScreen('screen-menu');
}

function downloadReceipt() {
  const el = document.getElementById('receipt-card');
  const text = el.innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `PCCOER_Receipt_${Date.now()}.txt`;
  a.click();
}

// ===== ADMIN — redirects to dedicated admin.html served by backend =====
function adminLogin() {
  window.location.href = API_BASE + '/admin.html';
}

// ===== LOGOUT =====
function confirmLogout() {
  document.getElementById('modal-logout').classList.remove('hidden');
}
function hideLogout() {
  document.getElementById('modal-logout').classList.add('hidden');
}
function doLogout() {
  hideLogout();
  localStorage.removeItem('canteen_token');
  localStorage.removeItem('canteen_role');
  localStorage.removeItem('canteen_user');
  cart = [];
  updateCartBadge();
  showScreen('screen-login');
}

// ===== POLICIES =====
function showPolicies() {
  document.getElementById('modal-policies').classList.remove('hidden');
}
function hidePolicies(e) {
  if (!e || e.target === document.getElementById('modal-policies') || e.currentTarget === document.querySelector('.modal-close')) {
    document.getElementById('modal-policies').classList.add('hidden');
  }
}

// ===== PASSWORD TOGGLE =====
function togglePw(inputId, icon) {
  const input = document.getElementById(inputId) || icon.previousElementSibling;
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// ===== QR CODE (simple canvas drawing) =====
function drawQR(text) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 200;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  // Draw a simple QR-like pattern based on text hash
  ctx.fillStyle = '#1a1a2e';
  const seed = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const grid = 20;
  const cell = size / grid;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // Corner finders
      if ((r < 3 && c < 3) || (r < 3 && c >= grid - 3) || (r >= grid - 3 && c < 3)) {
        if (r === 0 || r === 2 || c === 0 || c === 2 || (r === 1 && c === 1)) {
          ctx.fillRect(c * cell, r * cell, cell, cell);
        }
        continue;
      }
      // Data pattern
      const val = ((seed * (r + 1) * (c + 1)) % 17);
      if (val > 8) ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  // Border
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

// ===== UTILS =====
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
