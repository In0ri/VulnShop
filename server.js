/*
 * VulnShop — Intentionally Vulnerable E-commerce Lab
 * Focus: Authentication & Authorization flaws (NO SQL injection by design).
 * FOR AUTHORIZED SECURITY TRAINING ONLY. Do NOT deploy to production.
 */
const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----- tiny cookie parser (so we only depend on express) -----
app.use((req, res, next) => {
  req.cookies = {};
  const raw = req.headers.cookie;
  if (raw) raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) req.cookies[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  next();
});

// =====================================================================
//  WEAK JWT  (VULN: weak secret + accepts alg:none + signature/exp not
//  properly enforced). Implemented by hand so the flaws are explicit.
// =====================================================================
const JWT_SECRET = 'shop-secret-2021'; // VULN: weak, guessable, committed

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJSON = (obj) => b64url(JSON.stringify(obj));
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = b64urlJSON(header) + '.' + b64urlJSON(body);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return data + '.' + sig;
}

function verifyToken(token) {
  try {
    const [h, p, s] = token.split('.');
    const header = JSON.parse(fromB64url(h));
    const payload = JSON.parse(fromB64url(p));
    // VULN: "none" algorithm accepted — forge any token with no signature.
    if (header.alg === 'none') return payload;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (expected !== s) return null;
    // VULN: expiry is decoded but never enforced -> tokens never really expire.
    return payload;
  } catch (e) {
    return null;
  }
}

// =====================================================================
//  IN-MEMORY DATA  (no database -> no SQLi surface, as requested)
// =====================================================================
const db = {
  users: [
    { id: 1, username: 'admin', password: 'SuperAdmin!2021', email: 'admin@vulnshop.lab', role: 'admin', fullName: 'Site Administrator', address: '1 Admin Way', phone: '0900000001', balance: 999999, cardLast4: '4242', resetToken: null },
    { id: 2, username: 'alice', password: 'password1', email: 'alice@example.com', role: 'user', fullName: 'Alice Nguyen', address: '12 Rose St, Hanoi', phone: '0912345678', balance: 500, cardLast4: '1111', resetToken: null },
    { id: 3, username: 'bob', password: 'qwerty123', email: 'bob@example.com', role: 'user', fullName: 'Bob Tran', address: '34 Lake Rd, HCMC', phone: '0987654321', balance: 1200, cardLast4: '2222', resetToken: null },
    { id: 4, username: 'manager', password: 'Manager#99', email: 'manager@vulnshop.lab', role: 'manager', fullName: 'Store Manager', address: 'HQ Floor 3', phone: '0900000004', balance: 0, cardLast4: '7777', resetToken: null },
  ],
  products: [
    { id: 101, name: 'Aurora Wireless Headphones', price: 129.00, category: 'Audio', stock: 42, rating: 4.7, image: '🎧', desc: 'Active noise-cancelling over-ear headphones with 40h battery life.' },
    { id: 102, name: 'Nimbus Mechanical Keyboard', price: 89.50, category: 'Accessories', stock: 30, rating: 4.6, image: '⌨️', desc: 'Hot-swappable 75% mechanical keyboard with RGB backlight.' },
    { id: 103, name: 'Pulse Smartwatch 2', price: 199.99, category: 'Wearables', stock: 18, rating: 4.4, image: '⌚', desc: 'AMOLED fitness smartwatch with GPS and SpO2 tracking.' },
    { id: 104, name: 'Lumen 4K Webcam', price: 74.00, category: 'Video', stock: 55, rating: 4.3, image: '📷', desc: 'Auto-focus 4K webcam with dual noise-cancelling mics.' },
    { id: 105, name: 'Terra Portable SSD 1TB', price: 109.00, category: 'Storage', stock: 60, rating: 4.8, image: '💾', desc: 'USB-C 1050MB/s rugged portable SSD, pocket sized.' },
    { id: 106, name: 'Volt 100W GaN Charger', price: 45.00, category: 'Power', stock: 80, rating: 4.5, image: '🔌', desc: '3-port 100W GaN fast charger for laptop + phone + buds.' },
    { id: 107, name: 'Echo Bluetooth Speaker', price: 59.90, category: 'Audio', stock: 25, rating: 4.2, image: '🔊', desc: 'Waterproof 360° Bluetooth speaker, 20h playtime.' },
    { id: 108, name: 'Prism USB-C Hub 9-in-1', price: 52.00, category: 'Accessories', stock: 40, rating: 4.1, image: '🧩', desc: '9-in-1 hub: HDMI, 4K, SD, 3x USB-A, PD, Ethernet.' },
  ],
  orders: [
    { id: 5001, userId: 2, items: [{ id: 101, name: 'Aurora Wireless Headphones', price: 129.00, qty: 1 }], total: 129.00, status: 'delivered', address: '12 Rose St, Hanoi', createdAt: '2026-09-02', card: '**** 1111' },
    { id: 5002, userId: 3, items: [{ id: 103, name: 'Pulse Smartwatch 2', price: 199.99, qty: 1 }], total: 199.99, status: 'shipped', address: '34 Lake Rd, HCMC', createdAt: '2026-09-18', card: '**** 2222' },
    { id: 5003, userId: 1, items: [{ id: 105, name: 'Terra Portable SSD 1TB', price: 109.00, qty: 2 }], total: 218.00, status: 'processing', address: '1 Admin Way', createdAt: '2026-10-01', card: '**** 4242' },
  ],
  coupons: [
    { code: 'WELCOME10', percent: 10, active: true },
    { code: 'VIP50', percent: 50, active: true, note: 'internal staff only' },
    { code: 'FREESHIP', percent: 5, active: true },
    { code: 'STAFF100', percent: 100, active: true, note: 'internal — do not expose' },
  ],
};
let nextUserId = 5;
let nextOrderId = 5004;
const sanitize = (u) => { const { password, resetToken, ...rest } = u; return rest; };

// =====================================================================
//  AUTH MIDDLEWARE
// =====================================================================
function authenticate(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : req.cookies.token;
  if (!token) { req.user = null; return next(); }
  const payload = verifyToken(token);
  if (payload) {
    // VULN: role is taken straight from the (forgeable) token, never re-checked
    // against the DB. Combined with alg:none this is full identity spoofing.
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
  } else {
    req.user = null;
  }
  next();
}
app.use(authenticate);

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  next();
}

// =====================================================================
//  AUTHENTICATION ENDPOINTS
// =====================================================================

// VULN: user enumeration (distinct messages) + no rate limiting / lockout.
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'No account found with that username' });
  if (user.password !== password) return res.status(401).json({ error: 'Incorrect password for this user' });
  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  // VULN: token also dropped in a non-HttpOnly cookie (readable by JS -> XSS theft).
  res.setHeader('Set-Cookie', `token=${token}; Path=/; SameSite=Lax`);
  res.json({ token, user: sanitize(user) });
});

// VULN: mass assignment — attacker can set "role" at registration -> instant admin.
//       Also user-enumeration on duplicate username/email.
app.post('/api/register', (req, res) => {
  const body = req.body || {};
  if (db.users.find(u => u.username === body.username))
    return res.status(409).json({ error: 'Username already taken' });
  const user = {
    id: nextUserId++,
    role: 'user',
    balance: 0,
    cardLast4: null,
    resetToken: null,
    ...body, // VULN: spreads client input AFTER defaults -> role/balance overridable
  };
  db.users.push(user);
  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.setHeader('Set-Cookie', `token=${token}; Path=/; SameSite=Lax`);
  res.status(201).json({ token, user: sanitize(user) });
});

// VULN: predictable reset token (derived from id) AND it's returned in the
//       response body instead of being emailed privately.
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'No user with that email' }); // enumeration
  user.resetToken = 'reset-' + user.id + '-' + new Date().toISOString().slice(0, 10);
  res.json({ message: 'Reset link generated', resetToken: user.resetToken });
});

// VULN: reset accepts any matching token with no ownership/identity binding,
//       no expiry, and no old-password check.
app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  const user = db.users.find(u => u.resetToken && u.resetToken === token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });
  user.password = newPassword;
  user.resetToken = null;
  res.json({ message: 'Password updated' });
});

app.get('/api/me', requireLogin, (req, res) => {
  const user = db.users.find(u => u.id == req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitize(user));
});

// =====================================================================
//  USER ENDPOINTS
// =====================================================================

// VULN: BROKEN FUNCTION-LEVEL AUTHZ — any logged-in user lists ALL users
//       (full PII dump). No admin check.
app.get('/api/users', requireLogin, (req, res) => {
  res.json(db.users.map(sanitize));
});

// VULN: IDOR — fetch ANY user's profile by id, no ownership check.
app.get('/api/users/:id', requireLogin, (req, res) => {
  const user = db.users.find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitize(user));
});

// VULN: IDOR + mass assignment — update ANY user and set role/balance freely.
app.put('/api/users/:id', requireLogin, (req, res) => {
  const user = db.users.find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  Object.assign(user, req.body); // VULN: no field whitelist, no ownership check
  res.json(sanitize(user));
});

// VULN: horizontal privilege escalation — change ANY user's password with no
//       current-password verification and no ownership check.
app.post('/api/users/:id/change-password', requireLogin, (req, res) => {
  const user = db.users.find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.password = (req.body || {}).newPassword;
  res.json({ message: 'Password changed for user ' + user.id });
});

// =====================================================================
//  PRODUCT ENDPOINTS
// =====================================================================
app.get('/api/products', (req, res) => res.json(db.products));
app.get('/api/products/:id', (req, res) => {
  const p = db.products.find(p => p.id == req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

// VULN: BROKEN FUNCTION-LEVEL AUTHZ — product create/update/delete have no
//       admin (or even login) checks. Any visitor can edit the catalog.
app.post('/api/products', (req, res) => {
  const p = { id: Math.max(...db.products.map(x => x.id)) + 1, stock: 0, rating: 0, image: '📦', ...req.body };
  db.products.push(p);
  res.status(201).json(p);
});
app.put('/api/products/:id', (req, res) => {
  const p = db.products.find(p => p.id == req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  Object.assign(p, req.body);
  res.json(p);
});
app.delete('/api/products/:id', (req, res) => {
  db.products = db.products.filter(p => p.id != req.params.id);
  res.json({ message: 'deleted' });
});

// =====================================================================
//  COUPONS
// =====================================================================
// VULN: enumerable — returns full coupon incl. staff-only codes & notes.
app.get('/api/coupons/:code', (req, res) => {
  const c = db.coupons.find(c => c.code.toLowerCase() === String(req.params.code).toLowerCase());
  if (!c) return res.status(404).json({ error: 'Invalid coupon' });
  res.json(c);
});

// =====================================================================
//  ORDERS
// =====================================================================

// VULN: price trusted from client — server does NOT recompute totals from the
//       catalog, so cart items/prices/total can be tampered (business-logic authz).
app.post('/api/orders', requireLogin, (req, res) => {
  const { items, total, address, coupon } = req.body || {};
  const order = {
    id: nextOrderId++,
    userId: req.user.id,
    items: items || [],
    total: total,            // VULN: taken verbatim from the request
    status: 'processing',
    address: address || '',
    coupon: coupon || null,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  db.orders.push(order);
  res.status(201).json(order);
});

// VULN: ?userId= override lets you read ANY user's order history; with no
//       param it (correctly) scopes to you — the override is the bug.
app.get('/api/orders', requireLogin, (req, res) => {
  const uid = req.query.userId || req.user.id;
  res.json(db.orders.filter(o => o.userId == uid));
});

// VULN: IDOR — any order by id, including other users' (exposes address/card).
app.get('/api/orders/:id', requireLogin, (req, res) => {
  const o = db.orders.find(o => o.id == req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  res.json(o);
});

// VULN: IDOR invoice download, no ownership check.
app.get('/api/orders/:id/invoice', requireLogin, (req, res) => {
  const o = db.orders.find(o => o.id == req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  const u = db.users.find(u => u.id == o.userId) || {};
  res.json({
    invoice: 'INV-' + o.id,
    billedTo: u.fullName, email: u.email, address: o.address, card: o.card,
    items: o.items, total: o.total, date: o.createdAt,
  });
});

// =====================================================================
//  ADMIN ENDPOINTS
// =====================================================================

// VULN: VERTICAL privilege escalation via trusting a client header instead of
//       the authenticated role. Sending "X-Admin: true" is enough.
app.get('/api/admin/stats', (req, res) => {
  const isAdmin = req.headers['x-admin'] === 'true' || (req.user && req.user.role === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Admins only' });
  res.json({
    revenue: db.orders.reduce((s, o) => s + Number(o.total || 0), 0),
    orders: db.orders.length,
    users: db.users.length,
    products: db.products.length,
  });
});

// VULN: admin user list guarded only by a bypassable query param (?debug=1),
//       and leaks plaintext passwords.
app.get('/api/admin/users', (req, res) => {
  const ok = req.query.debug === '1' || (req.user && req.user.role === 'admin');
  if (!ok) return res.status(403).json({ error: 'Admins only' });
  res.json(db.users); // VULN: returns password + resetToken fields too
});

// VULN: full order list (all users) with only a bypassable query-param guard.
app.get('/api/admin/orders', (req, res) => {
  const ok = req.query.debug === '1' || (req.user && req.user.role === 'admin');
  if (!ok) return res.status(403).json({ error: 'Admins only' });
  res.json(db.orders);
});

// VULN: dangerous admin action (delete user) with NO server-side authz at all —
//       the UI just hides the button. Classic "security by obscurity".
app.delete('/api/admin/users/:id', (req, res) => {
  db.users = db.users.filter(u => u.id != req.params.id);
  res.json({ message: 'user removed' });
});

// VULN: promote any user to admin, no authz.
app.post('/api/admin/users/:id/promote', (req, res) => {
  const u = db.users.find(u => u.id == req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  u.role = 'admin';
  res.json(sanitize(u));
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('VulnShop lab running at http://localhost:' + PORT);
  console.log('Seed logins -> admin:SuperAdmin!2021 | alice:password1 | bob:qwerty123 | manager:Manager#99');
});
