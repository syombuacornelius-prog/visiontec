// --- GLOBAL SYSTEM STATE & DATA STORE ---
let activeWorker = localStorage.getItem('visiontecActiveWorker') || null;
let currentReceiptData = null;
let currentReportTab = 'sales';
let cart = [];

const publicPages = ['home', 'login'];

// Database data - initialized from server, never hardcoded
let products = [];
let customers = [];
let suppliers = [];
let expenses = [];
let salesHistory = [];

// Team and auth
let teamMembers = [];
let authToken = sessionStorage.getItem('visiontecToken') || null;
let currentMember = JSON.parse(sessionStorage.getItem('visiontecMember') || 'null');
const authHeaders = () => authToken ? { 'Authorization': 'Bearer ' + authToken } : {};

function isSystemAdmin() {
  return !!(currentMember && currentMember.is_admin);
}

async function handleManualLogin(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('login-user')?.value.trim();
  const password = document.getElementById('login-pass')?.value || '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const out = await res.json();
    
    if (!res.ok || !out.success) {
      showToast(out.message || 'Invalid credentials! Please enter authorized name & password.');
      return;
    }

    // Store auth data properly
    authToken = null; // We don't use tokens, we use session-based auth
    currentMember = out.user;
    activeWorker = out.user.username;
    
    sessionStorage.setItem('visiontecToken', 'session-active');
    sessionStorage.setItem('visiontecMember', JSON.stringify(currentMember));
    localStorage.setItem('visiontecActiveWorker', activeWorker);

    // Load data from database
    await loadDatabaseRecords();
    
    updateWorkerUI();
    showPage('dashboard');
    showToast(`Welcome back, ${out.user.username}`);

    if (document.getElementById('login-user')) document.getElementById('login-user').value = '';
    if (document.getElementById('login-pass')) document.getElementById('login-pass').value = '';
  } catch (err) {
    showToast('Server not reachable. Start it with node server.js.');
  }
}

async function loadTeamMembers() {
  // Team members are managed via the database sync system
  // No separate API needed
}

function renderTeamMembers() {
  const grid = document.getElementById('team-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Show message - team management is admin-only via database
  grid.innerHTML = '<p class="text-xs text-slate-400 col-span-full py-4 text-center">Team members are managed by the system administrator. Contact Cornelius for access.</p>';
}

function openPasswordModal(memberId) {
  if (!isSystemAdmin()) {
    showToast('Access Denied: Only the system administrator can manage member passwords.');
    return;
  }
  showToast('Password management is handled through the database directly.');
}

function closePasswordModal() {
  document.getElementById('password-modal').classList.add('hidden');
}

async function saveMemberPassword(e) {
  e.preventDefault();
  showToast('Password changes must be made directly in the database by the administrator.');
  closePasswordModal();
}

function printReceipt() {
  const receiptSection = document.getElementById('printable-receipt');
  if (!receiptSection) {
    showToast('Receipt printable element not found!');
    return;
  }

  receiptSection.classList.add('printable-active');
  window.print();
  setTimeout(() => {
    receiptSection.classList.remove('printable-active');
  }, 500);
}

function printCurrentReport() {
  if (!isSystemAdmin()) {
    showToast('Access Denied: Only the system administrator can print reports.');
    return;
  }

  const reportSection = document.getElementById('printable-report');
  if (!reportSection) {
    showToast('Report printable element not found!');
    return;
  }

  reportSection.classList.add('printable-active');
  window.print();
  setTimeout(() => {
    reportSection.classList.remove('printable-active');
  }, 500);
}

function isUserAuthenticated() {
  return !!(sessionStorage.getItem('visiontecToken') && currentMember);
}

function showPage(pageId) {
  if (!publicPages.includes(pageId) && !isUserAuthenticated()) {
    showToast('Access Denied: Please log in with a registered team account first.');
    pageId = 'login';
  }

  if ((pageId === 'expenses' || pageId === 'reports' || pageId === 'team') && !isSystemAdmin()) {
    showToast('Access Restricted: This page is restricted to the system administrator.');
    return;
  }

  if (pageId === 'login' && isUserAuthenticated()) {
    showPage('dashboard');
    return;
  }

  document.querySelectorAll('.page-section').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('border-amber-400', 'text-white');
    btn.classList.add('border-transparent', 'text-indigo-200');
  });
  const activeTopNav = document.getElementById('top-nav-' + pageId);
  if (activeTopNav) {
    activeTopNav.classList.remove('border-transparent', 'text-indigo-200');
    activeTopNav.classList.add('border-amber-400', 'text-white');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePasswordVisibility(inputId, iconId) {
  const field = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!field || !icon) return;

  if (field.type === 'password') {
    field.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    field.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function logoutWorker(message = 'Logged out successfully.') {
  if (authToken) {
    fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentMember?.username }) }).catch(() => {});
  }
  authToken = null;
  currentMember = null;
  activeWorker = null;
  teamMembers = [];
  sessionStorage.removeItem('visiontecToken');
  sessionStorage.removeItem('visiontecMember');
  localStorage.removeItem('visiontecActiveWorker');
  updateWorkerUI();
  showPage('login');
  showToast(message);
}

function updateWorkerUI() {
  const auth = isUserAuthenticated();
  const admin = isSystemAdmin();
  const member = auth ? currentMember : null;

  document.querySelectorAll('.auth-only').forEach(el => {
    if (auth) {
      el.classList.remove('hidden');
      if (el.tagName === 'BUTTON' && el.classList.contains('nav-btn')) el.classList.add('flex');
    } else {
      el.classList.add('hidden');
      if (el.tagName === 'BUTTON' && el.classList.contains('nav-btn')) el.classList.remove('flex');
    }
  });

  document.querySelectorAll('.auth-admin-only').forEach(el => {
    if (auth && admin) {
      el.classList.remove('hidden');
      if (el.tagName === 'BUTTON' && el.classList.contains('nav-btn')) el.classList.add('flex');
    } else {
      el.classList.add('hidden');
      if (el.tagName === 'BUTTON' && el.classList.contains('nav-btn')) el.classList.remove('flex');
    }
  });

  document.querySelectorAll('.nav-unauth').forEach(el => {
    if (auth) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  });

  const activeNameEl = document.getElementById('active-worker-name');
  const activeHomeEl = document.getElementById('home-active-user');
  const logoutBtn = document.getElementById('logout-btn');
  const dotEl = document.getElementById('user-status-dot');

  if (auth && member) {
    if (activeNameEl) activeNameEl.innerText = member.username;
    if (activeHomeEl) activeHomeEl.innerText = member.username;
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (dotEl) {
      dotEl.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
    }
  } else {
    if (activeNameEl) activeNameEl.innerText = 'Not Logged In';
    if (activeHomeEl) activeHomeEl.innerText = 'Locked (Log in required)';
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (dotEl) {
      dotEl.className = "w-2 h-2 rounded-full bg-rose-400";
    }
  }
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const query = (document.getElementById('product-search')?.value || '').toLowerCase();
  grid.innerHTML = '';

  const filtered = products.filter(p => p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query)));
  
  if (filtered.length === 0) {
    grid.innerHTML = '<p class="text-xs text-slate-400 col-span-full py-4 text-center">No products found. Add your first product using the "Add Product" button.</p>';
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex justify-between items-start gap-2">
          <span class="text-[10px] uppercase font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">${p.category || 'Uncategorized'}</span>
          <span class="text-xs font-bold ${p.stock < 5 ? 'text-amber-600' : 'text-slate-500'}">Stock: ${p.stock}</span>
        </div>
        <h4 class="font-bold text-sm text-slate-800 mt-2">${p.name}</h4>
        <p class="text-base font-black text-emerald-600 mt-1">Ksh ${Number(p.price).toLocaleString()}</p>
      </div>
      <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100">
        <button onclick="openEditProductModal('${p.id}')" class="flex-1 bg-slate-100 text-slate-700 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200">Edit</button>
        <button onclick="deleteProduct('${p.id}')" class="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderCustomers() {
  const list = document.getElementById('customers-list');
  if (!list) return;
  const query = (document.getElementById('customer-search')?.value || '').toLowerCase();
  list.innerHTML = '';

  const filtered = customers.filter(c => c.name.toLowerCase().includes(query || c.phone && c.phone.includes(query)));

  if (filtered.length === 0) {
    list.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No customers registered.</p>';
    return;
  }

  filtered.forEach(c => {
    const row = document.createElement('div');
    row.className = 'p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex justify-between items-center text-xs';
    row.innerHTML = `
      <div>
        <h4 class="font-bold text-slate-800">${c.name}</h4>
        <p class="text-slate-500 text-[11px]"><i class="fa-solid fa-phone text-slate-400 mr-1"></i>${c.phone} ${c.email ? '• ' + c.email : ''}</p>
      </div>
      <div class="flex gap-2">
        <button onclick="openEditCustomerModal('${c.id}')" class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">Edit</button>
        <button onclick="deleteCustomer('${c.id}')" class="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg font-bold">Delete</button>
      </div>
    `;
    list.appendChild(row);
  });
}

function renderSuppliers() {
  const grid = document.getElementById('suppliers-list');
  if (!grid) return;
  grid.innerHTML = '';

  if (suppliers.length === 0) {
    grid.innerHTML = '<p class="text-xs text-slate-400 col-span-full py-4 text-center">No suppliers listed.</p>';
    return;
  }

  suppliers.forEach(s => {
    const card = document.createElement('div');
    card.className = 'p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs flex justify-between items-center';
    card.innerHTML = `
      <div>
        <h4 class="font-bold text-slate-800">${s.name}</h4>
        <p class="text-slate-500 text-[11px]"><i class="fa-solid fa-phone text-slate-400 mr-1"></i>${s.contact}</p>
      </div>
      <span class="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-1 rounded-full">Supplier</span>
    `;
    grid.appendChild(card);
  });
}

function renderExpenses() {
  const list = document.getElementById('expenses-list');
  const sumEl = document.getElementById('expense-total-sum');
  if (!list) return;
  list.innerHTML = '';

  let total = 0;
  expenses.forEach(e => {
    total += Number(e.amount);
    const item = document.createElement('div');
    item.className = 'p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs flex justify-between items-center';
    item.innerHTML = `
      <div>
        <h4 class="font-bold text-slate-800">${e.title}</h4>
        <p class="text-slate-400 text-[10px]">${e.date}</p>
      </div>
      <span class="font-bold text-rose-600">Ksh ${Number(e.amount).toLocaleString()}</span>
    `;
    list.appendChild(item);
  });

  if (sumEl) sumEl.innerText = `Ksh ${total.toLocaleString()}`;
}

function renderPosCatalog() {
  const catalog = document.getElementById('pos-catalog');
  if (!catalog) return;
  const query = (document.getElementById('pos-search')?.value || '').toLowerCase();
  catalog.innerHTML = '';

  const filtered = products.filter(p => p.name.toLowerCase().includes(query) && p.stock > 0);

  filtered.forEach(p => {
    const item = document.createElement('div');
    item.className = 'bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-500 transition-colors';
    item.onclick = () => addToCart(p.id);
    item.innerHTML = `
      <div>
        <h5 class="font-bold text-xs text-slate-800 leading-tight">${p.name}</h5>
        <span class="text-[10px] text-slate-400">Stock: ${p.stock}</span>
      </div>
      <div class="mt-2 text-right">
        <span class="text-xs font-black text-emerald-600">Ksh ${Number(p.price).toLocaleString()}</span>
      </div>
    `;
    catalog.appendChild(item);
  });
}

function renderPosCustomerDropdown() {
  const select = document.getElementById('pos-customer-select');
  if (!select) return;
  select.innerHTML = '<option value="Walk-in Customer">Walk-in Customer</option>';
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.innerText = `${c.name} (${c.phone})`;
    select.appendChild(opt);
  });
}

function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p || p.stock <= 0) return;

  const existing = cart.find(x => x.id === productId);
  if (existing) {
    if (existing.qty < p.stock) existing.qty++;
    else showToast('Cannot exceed available stock!');
  } else {
    cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
  }
  renderCart();
}

function updateCartQty(id, delta) {
  const item = cart.find(x => x.id === id);
  const p = products.find(x => x.id === id);
  if (!item || !p) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(x => x.id !== id);
  } else if (item.qty > p.stock) {
    item.qty = p.stock;
    showToast('Maximum available stock reached!');
  }
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-item-count');
  const grandTotalEl = document.getElementById('cart-grand-total');

  if (!container) return;
  container.innerHTML = '';

  let grandTotal = 0;
  let totalQty = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    grandTotal += itemTotal;
    totalQty += item.qty;

    const row = document.createElement('div');
    row.className = 'flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg';
    row.innerHTML = `
      <div class="truncate max-w-[120px]">
        <p class="font-bold text-slate-800 truncate">${item.name}</p>
        <p class="text-[10px] text-slate-500">Ksh ${item.price.toLocaleString()}</p>
      </div>
      <div class="flex items-center gap-1.5">
        <button onclick="updateCartQty(${item.id}, -1)" class="w-5 h-5 bg-slate-200 rounded font-bold text-slate-700 flex items-center justify-center">-</button>
        <span class="font-bold text-xs">${item.qty}</span>
        <button onclick="updateCartQty(${item.id}, 1)" class="w-5 h-5 bg-slate-200 rounded font-bold text-slate-700 flex items-center justify-center">+</button>
      </div>
      <span class="font-bold text-slate-800">Ksh ${itemTotal.toLocaleString()}</span>
    `;
    container.appendChild(row);
  });

  if (countEl) countEl.innerText = totalQty;
  if (grandTotalEl) grandTotalEl.innerText = `Ksh ${grandTotal.toLocaleString()}`;
}

async function processSale() {
  if (cart.length === 0) {
    showToast('Cart is empty!');
    return;
  }

  const custSelect = document.getElementById('pos-customer-select');
  const custName = custSelect ? custSelect.value : 'Walk-in Customer';
  const paySelect = document.getElementById('pos-payment-method');
  const paymentMethod = paySelect ? paySelect.value : 'Cash';
  let saleTotal = 0;

  // Update local stock temporarily
  cart.forEach(cItem => {
    const p = products.find(x => x.id === cItem.id);
    if (p) p.stock -= cItem.qty;
    saleTotal += cItem.price * cItem.qty;
  });

  const newSale = {
    id: 'VT-' + Math.floor(1000 + Math.random() * 9000),
    date: new Date().toISOString().split('T')[0],
    customer: custName,
    worker: activeWorker || 'Staff',
    paymentMethod: paymentMethod,
    items: [...cart],
    total: saleTotal
  };

  currentReceiptData = newSale;
  salesHistory.unshift(newSale);
  renderReceipt(newSale);
  cart = [];
  renderCart();
  
  // Save to database
  await saveDatabaseRecords();
  
  renderAllData();
  showPage('receipt');
  showToast('Sale Completed Successfully!');
}

function downloadReceiptPDF() {
  const receiptElement = document.getElementById('printable-receipt');
  if (!receiptElement) return;

  showToast('Generating Receipt PDF...');

  html2canvas(receiptElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  }).then(canvas => {
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const receiptId = currentReceiptData ? currentReceiptData.id : 'receipt';
    pdf.save(`Visiontec_Receipt_${receiptId}.pdf`);
    showToast('Receipt PDF Downloaded!');
  }).catch(err => {
    console.error('PDF Generation Error:', err);
    showToast('Failed to generate PDF receipt.');
  });
}

function downloadReportPDF() {
  if (!isSystemAdmin()) {
    showToast('Access Denied: Only the system administrator can export PDF reports.');
    return;
  }

  const reportContainer = document.getElementById('page-reports');
  if (!reportContainer) return;

  showToast('Generating Reports PDF...');

  const reportTitle = currentReportTab.toUpperCase();
  const grossVal = document.getElementById('rep-gross-revenue').innerText;
  const expVal = document.getElementById('rep-total-expenses').innerText;
  const netVal = document.getElementById('rep-net-profit').innerText;
  const tabContentHtml = document.getElementById('report-tab-content').innerHTML;

  const pdfWrapper = document.createElement('div');
  pdfWrapper.style.padding = '20px';
  pdfWrapper.style.backgroundColor = '#ffffff';
  pdfWrapper.style.color = '#1e293b';
  pdfWrapper.style.fontFamily = 'sans-serif';
  pdfWrapper.style.width = '750px';

  pdfWrapper.innerHTML = `
    <div style="text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px;">
      <h1 style="margin: 0; font-size: 22px; color: #0f172a;">VISIONTEC COMPUTERS</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Official Store Operations & Financial Summary Report</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #0d9488; font-weight: bold;">Report Module: ${reportTitle} REPORT | Date: ${new Date().toLocaleDateString()}</p>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 10px;">
      <div style="flex: 1; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center; background: #f8fafc;">
        <span style="font-size: 10px; color: #64748b; font-weight: bold;">GROSS REVENUE</span>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #16a34a;">${grossVal}</p>
      </div>
      <div style="flex: 1; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center; background: #f8fafc;">
        <span style="font-size: 10px; color: #64748b; font-weight: bold;">TOTAL EXPENSES</span>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #dc2626;">${expVal}</p>
      </div>
      <div style="flex: 1; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center; background: #f8fafc;">
        <span style="font-size: 10px; color: #64748b; font-weight: bold;">ESTIMATED NET PROFIT</span>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #4f46e5;">${netVal}</p>
      </div>
    </div>

    <div style="margin-top: 10px;">
      <h3 style="font-size: 14px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Detailed Records</h3>
      <div>${tabContentHtml}</div>
    </div>

    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 10px; color: #94a3b8;">
      Generated by Visiontec Shop Management System • Staff: ${activeWorker || 'Admin'}
    </div>
  `;

  document.body.appendChild(pdfWrapper);

  html2canvas(pdfWrapper, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  }).then(canvas => {
    document.body.removeChild(pdfWrapper);
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Visiontec_${currentReportTab.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Report PDF Downloaded!');
  }).catch(err => {
    if (pdfWrapper.parentNode) document.body.removeChild(pdfWrapper);
    console.error('Report PDF Export Error:', err);
    showToast('Failed to export PDF report.');
  });
}

function renderReceipt(sale) {
  document.getElementById('rec-id').innerText = sale.id;
  document.getElementById('rec-date').innerText = sale.date;
  document.getElementById('rec-worker').innerText = sale.worker;
  document.getElementById('rec-customer').innerText = sale.customer;
  if (document.getElementById('rec-payment')) {
    document.getElementById('rec-payment').innerText = sale.paymentMethod || 'Cash';
  }
  document.getElementById('rec-total').innerText = `Ksh ${sale.total.toLocaleString()}`;

  const body = document.getElementById('rec-items-body');
  body.innerHTML = '';
  sale.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-1">${item.name}</td>
      <td class="py-1 text-center">${item.qty}</td>
      <td class="py-1 text-right">Ksh ${(item.price * item.qty).toLocaleString()}</td>
    `;
    body.appendChild(tr);
  });
}

function updateDashboardStats() {
  const totalSales = salesHistory.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const stockVal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0);

  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
  setText('dash-total-sales', `Ksh ${totalSales.toLocaleString()}`);
  setText('dash-total-expenses', `Ksh ${totalExpenses.toLocaleString()}`);
  setText('dash-stock-val', `Ksh ${stockVal.toLocaleString()}`);
  setText('dash-customer-count', customers.length);
  setText('home-stat-items', totalItems);
  setText('home-stat-sales', `Ksh ${totalSales.toLocaleString()}`);
  setText('home-stat-customers', customers.length);

  const recentContainer = document.getElementById('dash-recent-sales');
  if (!recentContainer) return;
  recentContainer.innerHTML = '';

  if (salesHistory.length === 0) {
    recentContainer.innerHTML = '<p class="text-xs text-slate-400 py-2">No sales completed yet.</p>';
    return;
  }

  salesHistory.slice(0, 5).forEach(s => {
    const item = document.createElement('div');
    item.className = 'p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center';
    item.innerHTML = `
      <div>
        <p class="font-bold text-slate-800">${s.id} — ${s.customer}</p>
        <p class="text-[10px] text-slate-400">${s.items.length} item(s) • ${s.paymentMethod || 'Cash'} • Processed by ${s.worker}</p>
      </div>
      <span class="font-bold text-emerald-600">Ksh ${s.total.toLocaleString()}</span>
    `;
    recentContainer.appendChild(item);
  });
}

function switchReportTab(tab) {
  currentReportTab = tab;
  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.className = 'report-tab-btn bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-200';
  });
  const activeTabBtn = document.getElementById('tab-rep-' + tab);
  if (activeTabBtn) {
    activeTabBtn.className = 'report-tab-btn bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5';
  }
  updateReports();
}

function updateReports() {
  let totalSales = salesHistory.reduce((sum, s) => sum + s.total, 0);
  let totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const grossEl = document.getElementById('rep-gross-revenue');
  const expEl = document.getElementById('rep-total-expenses');
  const netEl = document.getElementById('rep-net-profit');

  if (grossEl) grossEl.innerText = `Ksh ${totalSales.toLocaleString()}`;
  if (expEl) expEl.innerText = `Ksh ${totalExpenses.toLocaleString()}`;
  if (netEl) netEl.innerText = `Ksh ${(totalSales - totalExpenses).toLocaleString()}`;

  const container = document.getElementById('report-tab-content');
  if (!container) return;
  container.innerHTML = '';

  if (currentReportTab === 'sales') {
    if (salesHistory.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No sales records found yet.</p>';
      return;
    }
    salesHistory.forEach(s => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center';
      item.innerHTML = `
        <div>
          <p class="font-bold text-slate-800">${s.id} — ${s.customer}</p>
          <p class="text-[10px] text-slate-500">${s.items.length} item(s) • Paid via <strong class="text-emerald-700">${s.paymentMethod || 'Cash'}</strong> • Processed by ${s.worker} on ${s.date}</p>
        </div>
        <span class="font-bold text-emerald-600 text-sm">Ksh ${s.total.toLocaleString()}</span>
      `;
      container.appendChild(item);
    });
  } else if (currentReportTab === 'products') {
    let totalVal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    let header = document.createElement('div');
    header.className = 'bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-xs font-bold text-blue-800 flex justify-between';
    header.innerHTML = `<span>Total Stock Value:</span><span>Ksh ${totalVal.toLocaleString()}</span>`;
    container.appendChild(header);

    products.forEach(p => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center';
      item.innerHTML = `
        <div>
          <p class="font-bold text-slate-800">${p.name}</p>
          <p class="text-[10px] text-slate-500">Category: ${p.category || 'Uncategorized'} • Price: Ksh ${p.price.toLocaleString()}</p>
        </div>
        <span class="font-bold ${p.stock < 5 ? 'text-amber-600 bg-amber-50' : 'text-slate-800 bg-slate-100'} px-2 py-1 rounded">In Stock: ${p.stock}</span>
      `;
      container.appendChild(item);
    });
  } else if (currentReportTab === 'suppliers') {
    if (suppliers.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No registered suppliers found.</p>';
      return;
    }
    suppliers.forEach(s => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center';
      item.innerHTML = `
        <div>
          <p class="font-bold text-slate-800">${s.name}</p>
          <p class="text-[10px] text-slate-500"><i class="fa-solid fa-phone text-slate-400"></i> ${s.contact}</p>
        </div>
        <span class="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-1 rounded-full">Supplier</span>
      `;
      container.appendChild(item);
    });
  } else if (currentReportTab === 'expenses') {
    if (expenses.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No expense logs found.</p>';
      return;
    }
    expenses.forEach(e => {
      const item = document.createElement('div');
      item.className = 'p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center';
      item.innerHTML = `
        <div>
          <p class="font-bold text-slate-800">${e.title}</p>
          <p class="text-[10px] text-slate-400">Logged date: ${e.date}</p>
        </div>
        <span class="font-bold text-rose-600 text-sm">Ksh ${Number(e.amount).toLocaleString()}</span>
      `;
      container.appendChild(item);
    });
  }
}

function openAddProductModal() {
  document.getElementById('product-modal-title').innerText = 'Add Computer Product';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-stock').value = '';
  document.getElementById('product-modal').classList.remove('hidden');
}

function openEditProductModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-modal-title').innerText = 'Edit Product';
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  if (p.category) document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-stock').value = p.stock;
  document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value;
  const category = document.getElementById('prod-category').value;
  const price = Number(document.getElementById('prod-price').value);
  const stock = Number(document.getElementById('prod-stock').value);

  try {
    if (id && id.startsWith('prod-')) {
      // Update existing product - find and update in local array
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        products[index] = { id, name, category, price, stock };
        await saveDatabaseRecords();
        renderAllData();
        closeProductModal();
        showToast('Product updated successfully!');
      }
    } else {
      // Create new product via API
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, price, stock })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create product');
      }
      
      const result = await response.json();
      // Reload data from database
      await loadDatabaseRecords();
      closeProductModal();
      showToast('Product created successfully!');
    }
  } catch (error) {
    console.error('Product save error:', error);
    showToast('Error: ' + error.message);
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
  
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete product');
    }
    
    // Reload data from database
    await loadDatabaseRecords();
    showToast('Product deleted successfully');
  } catch (error) {
    console.error('Product delete error:', error);
    showToast('Error: ' + error.message);
  }
}

function openCustomerModal() {
  document.getElementById('customer-modal-title').innerText = 'Add Customer';
  document.getElementById('cust-id').value = '';
  document.getElementById('cust-name').value = '';
  document.getElementById('cust-phone').value = '';
  document.getElementById('cust-email').value = '';
  document.getElementById('customer-modal').classList.remove('hidden');
}

function openEditCustomerModal(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('customer-modal-title').innerText = 'Edit Customer';
  document.getElementById('cust-id').value = c.id;
  document.getElementById('cust-name').value = c.name;
  document.getElementById('cust-phone').value = c.phone;
  document.getElementById('cust-email').value = c.email;
  document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.add('hidden');
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('cust-id').value;
  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const email = document.getElementById('cust-email').value;

  // For now, save to local array and sync
  if (id) {
    const c = customers.find(x => x.id == id);
    if (c) {
      c.name = name;
      c.phone = phone;
      c.email = email;
    }
  } else {
    customers.push({ id: `cust-${Date.now()}`, name, phone, email: email || '' });
  }

  closeCustomerModal();
  await saveDatabaseRecords();
  renderAllData();
  showToast('Customer saved.');
}

async function deleteCustomer(id) {
  if (!confirm('Are you sure you want to delete this customer?')) return;
  customers = customers.filter(c => c.id !== id);
  await saveDatabaseRecords();
  renderAllData();
  showToast('Customer removed.');
}

function openSupplierModal() { document.getElementById('supplier-modal').classList.remove('hidden'); }
function closeSupplierModal() { document.getElementById('supplier-modal').classList.add('hidden'); }
async function saveSupplier(e) {
  e.preventDefault();
  const name = document.getElementById('supp-name').value;
  const contact = document.getElementById('supp-contact').value;
  suppliers.push({ id: `supp-${Date.now()}`, name, contact });
  closeSupplierModal();
  await saveDatabaseRecords();
  renderAllData();
  showToast('Supplier added.');
}

function openExpenseModal() { 
  if (!isSystemAdmin()) {
    showToast('Access Denied: Only the system administrator can log expenses.');
    return;
  }
  document.getElementById('expense-modal').classList.remove('hidden'); 
}
function closeExpenseModal() { document.getElementById('expense-modal').classList.add('hidden'); }
async function saveExpense(e) {
  e.preventDefault();
  if (!isSystemAdmin()) {
    showToast('Access Denied: Only the system administrator can save expenses.');
    closeExpenseModal();
    return;
  }
  const title = document.getElementById('exp-title').value;
  const amount = Number(document.getElementById('exp-amount').value);
  expenses.push({ id: `exp-${Date.now()}`, title, amount, date: new Date().toISOString().split('T')[0] });
  closeExpenseModal();
  await saveDatabaseRecords();
  renderAllData();
  showToast('Expense logged.');
}

function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-drawer');
  drawer.classList.toggle('hidden');
}

// --- DATABASE SYNC SYSTEM ---
let databaseReady = false;
let databaseSaveTimer = null;

async function loadDatabaseRecords() {
  try {
    const response = await fetch('/api/bootstrap');
    if (!response.ok) throw new Error('Database API unavailable');
    const result = await response.json();
    
    if (result.empty) {
      databaseReady = true;
      return;
    }
    
    const data = result.data || {};
    if (Array.isArray(data.products)) products = data.products;
    if (Array.isArray(data.customers)) customers = data.customers;
    if (Array.isArray(data.suppliers)) suppliers = data.suppliers;
    if (Array.isArray(data.expenses)) expenses = data.expenses;
    if (Array.isArray(data.sales)) salesHistory = data.sales;
    
    databaseReady = true;
    updateWorkerUI();
    renderAllData();
  } catch (error) {
    console.warn('Database connection error:', error.message);
    showToast('Database not connected. Ensure the server is running.');
  }
}

async function saveDatabaseRecords() {
  if (!databaseReady) return;
  
  const payload = {
    products, customers, suppliers, sales: salesHistory,
    expenses
  };
  
  try {
    const response = await fetch('/api/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload })
    });
    
    if (!response.ok) throw new Error('Database save failed');
  } catch (error) {
    console.error('Database save error:', error);
    showToast('Could not save changes to database.');
  }
}

function scheduleDatabaseSave() {
  if (!databaseReady) return;
  clearTimeout(databaseSaveTimer);
  databaseSaveTimer = setTimeout(saveDatabaseRecords, 350);
}

function renderAllData() {
  renderProducts();
  renderCustomers();
  renderSuppliers();
  renderExpenses();
  renderPosCatalog();
  renderPosCustomerDropdown();
  renderTeamMembers();
  updateDashboardStats();
  updateReports();
}

function showToast(msg) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'fixed bottom-5 right-5 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl transition-all transform translate-y-20 opacity-0 z-50 flex items-center gap-2';
    toast.innerHTML = '<i class="fa-solid fa-circle-info text-indigo-400"></i><span id="toast-message"></span>';
    document.body.appendChild(toast);
  }
  document.getElementById('toast-message').innerText = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

window.onload = async function() {
  updateWorkerUI();
  await loadDatabaseRecords();
  renderAllData();
  showPage('home');
};