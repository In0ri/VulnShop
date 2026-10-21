// ---------- tiny helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => '$' + Number(n || 0).toFixed(2);
const view = $('#view');

let token = localStorage.getItem('token') || null;
let me = JSON.parse(localStorage.getItem('me') || 'null');
let products = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let discountPct = 0, appliedCoupon = null;
let searchQuery = '';

async function api(path, opts = {}) {
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch('/api' + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Error'), { status: r.status, data });
  return data;
}
function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast ' + type, 2200);
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); renderCartBadge(); }

// ---------- modal ----------
function modal(title, bodyHtml) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg'; bg.id = 'modalBg';
  bg.innerHTML = `<div class="modal"><div class="mhead"><h3>${title}</h3>
    <button class="icon-btn" id="modalClose">✕</button></div><div class="mbody">${bodyHtml}</div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  $('#modalClose').onclick = closeModal;
  return bg;
}
function closeModal() { const m = $('#modalBg'); if (m) m.remove(); }

// ---------- auth state UI ----------
function renderUserBox() {
  const box = $('#userBox');
  if (me) {
    box.innerHTML = `<span class="muted" style="margin-right:10px">Hi, <b>${me.username}</b></span>
      <button class="btn ghost sm" id="logoutBtn">Logout</button>`;
    $('#logoutBtn').onclick = logout;
    $('#adminLink').style.display = me.role === 'admin' ? 'inline-block' : 'none';
  } else {
    box.innerHTML = `<button class="btn sm" data-route="login" id="loginBtn">Sign in</button>`;
    $('#loginBtn').onclick = () => go('login');
    $('#adminLink').style.display = 'none';
  }
}
function logout() {
  token = null; me = null;
  localStorage.removeItem('token'); localStorage.removeItem('me');
  document.cookie = 'token=; Max-Age=0; Path=/';
  renderUserBox(); go('home'); toast('Signed out');
}

// ---------- router ----------
function go(route, param) { location.hash = route + (param ? '/' + param : ''); }
window.addEventListener('hashchange', router);
$$('[data-route]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.route); }));

let currentRoute = 'home';
function router() {
  const [route, param] = location.hash.replace(/^#/, '').split('/');
  currentRoute = route || 'home';
  ({ home: renderHome, product: renderProduct, login: renderAuth, account: renderAccount,
     orders: renderOrders, admin: renderAdmin }[currentRoute] || renderHome)(param);
  window.scrollTo(0, 0);
}
// Route guard: an async render that resolves AFTER the user navigated away must
// not overwrite the new view. (Fixes the "login form flashes then disappears" bug
// where the initial async renderHome() clobbered the view once /products loaded.)
const onRoute = (r) => currentRoute === r;

// ---------- pages ----------
async function renderHome() {
  if (!products.length) products = await api('/products');
  if (!onRoute('home')) return;
  const q = searchQuery.toLowerCase();
  const list = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  view.innerHTML = `
    <section class="hero">
      <span class="pill">◆ New season drops</span>
      <h1>Gear that keeps up<br>with your hustle.</h1>
      <p>Premium audio, wearables and desk setups — curated, fast-shipped, and backed by a 2-year warranty.</p>
      <button class="btn" onclick="document.querySelector('#grid').scrollIntoView({behavior:'smooth'})">Shop now →</button>
    </section>
    <div class="section-title"><h2>${q ? 'Results for “' + q + '”' : 'Featured products'}</h2>
      <span class="muted">${list.length} item${list.length === 1 ? '' : 's'}</span></div>
    ${list.length === 0 ? `<div class="panel" style="text-align:center">
      <p class="muted">No products match “${q}”.</p>
      <button class="btn ghost sm" onclick="document.querySelector('#searchInput').value='';document.querySelector('#searchInput').dispatchEvent(new Event('input'))">Clear search</button></div>` : ''}
    <div class="grid" id="grid">
      ${list.map(p => `
        <div class="card">
          <div class="thumb" data-route="product" data-id="${p.id}" style="cursor:pointer">${p.image}</div>
          <div class="body">
            <span class="cat">${p.category}</span>
            <h3>${p.name}</h3>
            <div class="desc">${p.desc}</div>
            <div class="row">
              <span class="price">${money(p.price)}</span>
              <span class="rating">★ ${p.rating}</span>
            </div>
            <button class="btn block sm add" data-id="${p.id}" style="margin-top:8px">Add to cart</button>
          </div>
        </div>`).join('')}
    </div>`;
  $$('.add').forEach(b => b.onclick = () => addToCart(+b.dataset.id));
  $$('[data-route="product"]').forEach(b => b.onclick = () => go('product', b.dataset.id));
}

async function renderProduct(id) {
  const p = await api('/products/' + id);
  if (!onRoute('product')) return;
  view.innerHTML = `
    <div class="panel" style="display:grid;grid-template-columns:260px 1fr;gap:28px">
      <div class="thumb" style="font-size:120px;height:280px;border-radius:14px;display:grid;place-items:center;background:var(--panel2)">${p.image}</div>
      <div>
        <span class="cat" style="color:var(--accent)">${p.category}</span>
        <h1 style="margin:6px 0">${p.name}</h1>
        <div class="rating" style="margin-bottom:10px">★ ${p.rating} · ${p.stock} in stock</div>
        <p class="muted">${p.desc}</p>
        <div class="price" style="font-size:30px;margin:16px 0">${money(p.price)}</div>
        <button class="btn" id="addP">Add to cart</button>
        <button class="btn ghost" onclick="history.back()">← Back</button>
      </div>
    </div>`;
  $('#addP').onclick = () => addToCart(p.id);
}

function renderAuth() {
  view.innerHTML = `
  <div class="auth-wrap panel">
    <div class="tabs">
      <button class="active" id="tabLogin">Sign in</button>
      <button id="tabReg">Create account</button>
    </div>
    <div id="formLogin">
      <div class="field"><label>Username</label><input id="li_u" placeholder="alice"></div>
      <div class="field"><label>Password</label><input id="li_p" type="password" placeholder="••••••••"></div>
      <button class="btn block" id="doLogin">Sign in</button>
      <p class="hint"><a href="#" id="forgotLink">Forgot password?</a></p>
      <p class="hint">Demo: alice / password1 · bob / qwerty123</p>
    </div>
    <div id="formReg" class="hide">
      <div class="two">
        <div class="field"><label>Username</label><input id="rg_u"></div>
        <div class="field"><label>Email</label><input id="rg_e"></div>
      </div>
      <div class="field"><label>Full name</label><input id="rg_n"></div>
      <div class="field"><label>Password</label><input id="rg_p" type="password"></div>
      <button class="btn block" id="doReg">Create account</button>
    </div>
  </div>`;
  const show = (login) => { $('#formLogin').classList.toggle('hide', !login);
    $('#formReg').classList.toggle('hide', login);
    $('#tabLogin').classList.toggle('active', login); $('#tabReg').classList.toggle('active', !login); };
  $('#tabLogin').onclick = () => show(true);
  $('#tabReg').onclick = () => show(false);
  $('#forgotLink').onclick = (e) => { e.preventDefault(); renderForgot(); };
  $('#doLogin').onclick = async () => {
    try {
      const d = await api('/login', { method: 'POST', body: JSON.stringify({ username: $('#li_u').value, password: $('#li_p').value }) });
      setSession(d); toast('Welcome back, ' + d.user.username, 'ok'); go('home');
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#doReg').onclick = async () => {
    try {
      const d = await api('/register', { method: 'POST', body: JSON.stringify({
        username: $('#rg_u').value, email: $('#rg_e').value, fullName: $('#rg_n').value, password: $('#rg_p').value }) });
      setSession(d); toast('Account created', 'ok'); go('home');
    } catch (e) { toast(e.message, 'err'); }
  };
}
function renderForgot() {
  view.innerHTML = `
  <div class="auth-wrap panel">
    <h2>Reset password</h2>
    <div class="field"><label>Account email</label><input id="fp_e" placeholder="you@example.com"></div>
    <button class="btn block" id="fp_go">Send reset link</button>
    <div id="fp_step2" class="hide" style="margin-top:18px">
      <div class="field"><label>Reset token</label><input id="fp_t"></div>
      <div class="field"><label>New password</label><input id="fp_np" type="password"></div>
      <button class="btn block" id="fp_do">Update password</button>
    </div>
    <p class="hint"><a href="#" onclick="location.hash='login';return false">← Back to sign in</a></p>
  </div>`;
  $('#fp_go').onclick = async () => {
    try {
      const d = await api('/forgot-password', { method: 'POST', body: JSON.stringify({ email: $('#fp_e').value }) });
      $('#fp_step2').classList.remove('hide');
      $('#fp_t').value = d.resetToken;
      toast('Reset token issued (shown below)', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#fp_do').onclick = async () => {
    try {
      await api('/reset-password', { method: 'POST', body: JSON.stringify({ token: $('#fp_t').value, newPassword: $('#fp_np').value }) });
      toast('Password updated — sign in', 'ok'); go('login');
    } catch (e) { toast(e.message, 'err'); }
  };
}
function setSession(d) {
  token = d.token; me = d.user;
  localStorage.setItem('token', token); localStorage.setItem('me', JSON.stringify(me));
  renderUserBox();
}

async function renderAccount() {
  if (!me) return go('login');
  const u = await api('/account');
  if (!onRoute('account')) return;
  view.innerHTML = `
  <div class="panel">
    <h2>My account</h2>
    <div class="two">
      <div class="field"><label>Full name</label><input id="ac_n" value="${u.fullName || ''}"></div>
      <div class="field"><label>Email</label><input id="ac_e" value="${u.email || ''}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Phone</label><input id="ac_ph" value="${u.phone || ''}"></div>
      <div class="field"><label>Address</label><input id="ac_a" value="${u.address || ''}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Role</label><input value="${u.role}" disabled></div>
      <div class="field"><label>Store credit</label><input value="${money(u.balance)}" disabled></div>
    </div>
    <button class="btn" id="ac_save">Save changes</button>
  </div>
  <div class="panel">
    <h3>Change password</h3>
    <div class="field"><label>Current password</label><input id="ac_cp" type="password"></div>
    <div class="field"><label>New password</label><input id="ac_np" type="password"></div>
    <button class="btn ghost" id="ac_pw">Update password</button>
  </div>`;
  $('#ac_save').onclick = async () => {
    try {
      await api('/account', { method: 'PATCH', body: JSON.stringify({
        fullName: $('#ac_n').value, email: $('#ac_e').value, phone: $('#ac_ph').value, address: $('#ac_a').value }) });
      toast('Profile saved', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#ac_pw').onclick = async () => {
    try {
      await api('/account/password', { method: 'POST', body: JSON.stringify({
        currentPassword: $('#ac_cp').value, newPassword: $('#ac_np').value }) });
      toast('Password changed', 'ok'); $('#ac_cp').value = ''; $('#ac_np').value = '';
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function renderOrders() {
  if (!me) return go('login');
  const orders = await api('/orders');
  if (!onRoute('orders')) return;
  view.innerHTML = `
  <div class="section-title"><h2>My orders</h2><span class="muted">signed in as ${me.username}</span></div>
  <div class="panel">
    ${orders.length ? `<table><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${orders.map(o => `<tr>
      <td>#${o.id}</td><td>${o.createdAt}</td>
      <td>${o.items.map(i => i.name + ' ×' + i.qty).join(', ')}</td>
      <td>${money(o.total)}</td>
      <td><span class="status">${o.status}</span></td>
      <td><button class="btn ghost sm inv" data-id="${o.id}">View invoice</button></td>
    </tr>`).join('')}</tbody></table>`
    : '<p class="muted">No orders yet — go buy something!</p>'}
  </div>`;
  const openInvoice = async (id) => {
    try {
      const inv = await api('/orders/' + id + '/invoice');
      modal('Invoice ' + inv.invoice, `
        <div class="kv">
          <span class="k">Billed to</span><span>${inv.billedTo || '—'}</span>
          <span class="k">Email</span><span>${inv.email || '—'}</span>
          <span class="k">Ship address</span><span>${inv.address || '—'}</span>
          <span class="k">Payment card</span><span>${inv.card || '—'}</span>
          <span class="k">Date</span><span>${inv.date || '—'}</span>
        </div>
        <table class="invoice-items"><tbody>
          ${(inv.items || []).map(i => `<tr><td>${i.name} ×${i.qty}</td><td style="text-align:right">${money(i.price * i.qty)}</td></tr>`).join('')}
          <tr><td><b>Total</b></td><td style="text-align:right"><b>${money(inv.total)}</b></td></tr>
        </tbody></table>`);
    } catch (e) { toast(e.message, 'err'); }
  };
  $$('.inv').forEach(b => b.onclick = () => openInvoice(b.dataset.id));
}

let adminTab = 'overview';
async function renderAdmin() {
  view.innerHTML = `
    <div class="section-title"><h2>Admin dashboard</h2><span class="muted">internal tools</span></div>
    <div class="atabs">
      <button data-tab="overview">Overview</button>
      <button data-tab="users">Users</button>
      <button data-tab="products">Products</button>
      <button data-tab="orders">Orders</button>
    </div>
    <div id="adminBody" class="panel"><p class="muted">Loading…</p></div>`;
  $$('.atabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === adminTab);
    b.onclick = () => { adminTab = b.dataset.tab; renderAdmin(); };
  });
  try {
    if (adminTab === 'users') await adminUsers();
    else if (adminTab === 'products') await adminProducts();
    else if (adminTab === 'orders') await adminOrders();
    else await adminOverview();
  } catch (e) {
    if (onRoute('admin')) $('#adminBody').innerHTML = `<p class="muted">Access denied: ${e.message}</p>`;
  }
}
async function adminOverview() {
  const stats = await api('/admin/stats');
  if (!onRoute('admin')) return;
  $('#adminBody').innerHTML = `
    <div class="stat-row">
      <div class="stat"><div class="lbl">Revenue</div><div class="val">${money(stats.revenue)}</div></div>
      <div class="stat"><div class="lbl">Orders</div><div class="val">${stats.orders}</div></div>
      <div class="stat"><div class="lbl">Users</div><div class="val">${stats.users}</div></div>
      <div class="stat"><div class="lbl">Products</div><div class="val">${stats.products}</div></div>
    </div>`;
}
async function adminUsers() {
  const users = await api('/admin/users');
  if (!onRoute('admin')) return;
  $('#adminBody').innerHTML = `
    <table><thead><tr><th>ID</th><th>User</th><th>Email</th><th>Role</th><th>Balance</th><th>Actions</th></tr></thead>
    <tbody>${users.map(u => `<tr>
      <td>${u.id}</td><td>${u.username}</td><td>${u.email}</td>
      <td><select class="inline-input urole" data-id="${u.id}">
        ${['user', 'manager', 'admin'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select></td>
      <td>${money(u.balance)}</td>
      <td style="white-space:nowrap">
        <button class="btn sm usave" data-id="${u.id}">Save role</button>
        <button class="btn danger sm udel" data-id="${u.id}">Delete</button>
      </td></tr>`).join('')}</tbody></table>`;
  $$('.usave').forEach(b => b.onclick = async () => {
    const id = b.dataset.id;
    await api('/admin/users/' + id + '/role', { method: 'POST', body: JSON.stringify({
      role: $(`.urole[data-id="${id}"]`).value }) });
    toast('User ' + id + ' updated', 'ok'); renderAdmin();
  });
  $$('.udel').forEach(b => b.onclick = async () => {
    await api('/admin/users/' + b.dataset.id, { method: 'DELETE' });
    toast('User deleted', 'ok'); renderAdmin();
  });
}
async function adminProducts() {
  const list = await api('/products');
  if (!onRoute('admin')) return;
  $('#adminBody').innerHTML = `
    <table><thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
    <tbody>${list.map(p => `<tr>
      <td>${p.id}</td><td>${p.image} ${p.name}</td>
      <td><input class="inline-input pprice" data-id="${p.id}" value="${p.price}"></td>
      <td><input class="inline-input pstock" data-id="${p.id}" value="${p.stock}"></td>
      <td style="white-space:nowrap">
        <button class="btn sm psave" data-id="${p.id}">Save</button>
        <button class="btn danger sm pdel" data-id="${p.id}">Delete</button>
      </td></tr>`).join('')}</tbody></table>
    <h3 style="margin-top:22px">Add a product</h3>
    <div class="two">
      <div class="field"><label>Name</label><input id="np_name"></div>
      <div class="field"><label>Category</label><input id="np_cat" value="Misc"></div>
    </div>
    <div class="two">
      <div class="field"><label>Price</label><input id="np_price" value="0"></div>
      <div class="field"><label>Stock</label><input id="np_stock" value="0"></div>
    </div>
    <div class="field"><label>Description</label><input id="np_desc"></div>
    <button class="btn" id="np_add">Create product</button>`;
  $$('.psave').forEach(b => b.onclick = async () => {
    const id = b.dataset.id;
    await api('/products/' + id, { method: 'PUT', body: JSON.stringify({
      price: Number($(`.pprice[data-id="${id}"]`).value), stock: Number($(`.pstock[data-id="${id}"]`).value) }) });
    products = []; toast('Product ' + id + ' updated', 'ok'); renderAdmin();
  });
  $$('.pdel').forEach(b => b.onclick = async () => {
    await api('/products/' + b.dataset.id, { method: 'DELETE' });
    products = []; toast('Product deleted', 'ok'); renderAdmin();
  });
  $('#np_add').onclick = async () => {
    await api('/products', { method: 'POST', body: JSON.stringify({
      name: $('#np_name').value, category: $('#np_cat').value, desc: $('#np_desc').value,
      price: Number($('#np_price').value), stock: Number($('#np_stock').value) }) });
    products = []; toast('Product created', 'ok'); renderAdmin();
  };
}
async function adminOrders() {
  const orders = await api('/admin/orders');
  if (!onRoute('admin')) return;
  $('#adminBody').innerHTML = `
    <table><thead><tr><th>Order</th><th>User</th><th>Items</th><th>Total</th><th>Status</th><th>Address</th></tr></thead>
    <tbody>${orders.map(o => `<tr>
      <td>#${o.id}</td><td>${o.userId}</td>
      <td>${o.items.map(i => i.name + ' ×' + i.qty).join(', ')}</td>
      <td>${money(o.total)}</td><td><span class="status">${o.status}</span></td><td>${o.address || '—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

// ---------- cart ----------
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const it = cart.find(x => x.id === id);
  if (it) it.qty++; else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 });
  saveCart(); renderCart(); openCart(); toast('Added to cart', 'ok');
}
function renderCartBadge() { $('#cartBadge').textContent = cart.reduce((s, i) => s + i.qty, 0); }
function renderCart() {
  const box = $('#cartItems');
  box.innerHTML = cart.length ? cart.map(i => `
    <div class="citem">
      <div class="ic">${i.image}</div>
      <div class="meta"><div><b>${i.name}</b></div><div class="muted">${money(i.price)}</div></div>
      <div class="qty">
        <button data-m="-1" data-id="${i.id}">−</button><span>${i.qty}</span>
        <button data-m="1" data-id="${i.id}">+</button>
      </div>
    </div>`).join('') : '<p class="muted" style="padding:20px 0">Your cart is empty.</p>';
  $$('#cartItems .qty button').forEach(b => b.onclick = () => {
    const it = cart.find(x => x.id === +b.dataset.id);
    it.qty += +b.dataset.m;
    if (it.qty <= 0) cart = cart.filter(x => x.id !== it.id);
    saveCart(); renderCart();
  });
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const disc = sub * discountPct / 100;
  $('#subTotal').textContent = money(sub);
  $('#discount').textContent = '-' + money(disc);
  $('#grandTotal').textContent = money(sub - disc);
}
const openCart = () => { $('#drawer').classList.add('open'); $('#drawerBg').classList.add('open'); renderCart(); };
const closeCart = () => { $('#drawer').classList.remove('open'); $('#drawerBg').classList.remove('open'); };
$('#cartBtn').onclick = openCart;
$('#closeCart').onclick = closeCart;
$('#drawerBg').onclick = closeCart;

$('#applyCoupon').onclick = async () => {
  try {
    const c = await api('/coupons/' + encodeURIComponent($('#couponInput').value));
    discountPct = c.percent; appliedCoupon = c.code;
    $('#couponHint').textContent = `Applied ${c.code}: ${c.percent}% off${c.note ? ' (' + c.note + ')' : ''}`;
    renderCart(); toast('Coupon applied', 'ok');
  } catch (e) { $('#couponHint').textContent = e.message; toast(e.message, 'err'); }
};

$('#checkoutBtn').onclick = async () => {
  if (!me) { closeCart(); return go('login'); }
  if (!cart.length) return toast('Cart is empty', 'err');
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = sub - sub * discountPct / 100;
  try {
    const o = await api('/orders', { method: 'POST', body: JSON.stringify({
      items: cart, total, coupon: appliedCoupon, address: (me && me.address) || '' }) });
    cart = []; discountPct = 0; appliedCoupon = null; saveCart(); renderCart(); closeCart();
    toast('Order #' + o.id + ' placed!', 'ok'); go('orders');
  } catch (e) { toast(e.message, 'err'); }
};

// Search works from ANY page: typing jumps to the store and filters live.
$('#searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  if (currentRoute === 'home') renderHome(); else go('home');
});

// ---------- boot ----------
renderUserBox(); renderCartBadge();
if (!location.hash) location.hash = 'home';
router();
