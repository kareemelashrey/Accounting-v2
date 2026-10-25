const SUPABASE_URL = 'https://wjdhikxuwootmsnztmgb.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_6JNfXXpQLxlxSdyF4XWKng_ZYaNccSE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentCompanyId = null, invoiceItems = [], invoicePayments = [], allProducts = [], allCustomers = [], allWallets = [];

const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const userEmailSpan = document.getElementById('userEmail');

function showPage(pageId, element) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('bg-slate-700','text-blue-400','border-r-4','border-blue-500'));
    if(element) element.classList.add('bg-slate-700','text-blue-400','border-r-4','border-blue-500');
    document.getElementById('pageTitle').innerText = { 'home': 'الرئيسية', 'inventory': 'المخزون', 'customers': 'العملاء', 'sales': 'المبيعات', 'customer-payments': 'دفعات العملاء', 'purchases': 'المشتريات', 'supplier-payments': 'دفعات الموردين', 'returns': 'المرتجعات', 'cheques': 'الشيكات', 'cash': 'الخزينة', 'employees': 'الموظفين', 'reports': 'التقارير' }[pageId];
    
    if(pageId === 'inventory') loadProducts();
    if(pageId === 'customers') loadCustomers();
    if(pageId === 'sales') loadInvoiceData();
    if(pageId === 'customer-payments') loadCustomerPayments();
    if(pageId === 'purchases') loadPurchases();
    if(pageId === 'supplier-payments') loadSupplierPayments();
    if(pageId === 'returns') loadReturnInvoices();
    if(pageId === 'cheques') loadCheques();
    if(pageId === 'cash') loadWallets();
    if(pageId === 'reports') loadReports();
}

async function fetchCompany() {
    const { data: { user } } = await supabase.auth.getUser();
    if(user) { const { data } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single(); if(data) currentCompanyId = data.company_id; }
}
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if(session) { loginScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); userEmailSpan.innerText = session.user.email; await fetchCompany(); }
    else { loginScreen.classList.remove('hidden'); dashboardScreen.classList.add('hidden'); }
}

document.getElementById('toggleRegisterBtn').onclick = () => {
    const fields = document.getElementById('companyFields');
    fields.classList.toggle('hidden');
    document.getElementById('loginBtn').innerText = fields.classList.contains('hidden') ? 'دخول' : 'إنشاء شركة ودخول';
};
document.getElementById('loginBtn').onclick = async () => {
    const em = document.getElementById('email').value, pw = document.getElementById('password').value;
    if(!em || !pw) return;
    try {
        const isRegister = !document.getElementById('companyFields').classList.contains('hidden');
        if(isRegister) {
            const cn = document.getElementById('companyName').value, bn = document.getElementById('branchName').value;
            const { data: a, error: errA } = await supabase.auth.signUp({ email: em, password: pw }); if (errA) throw errA;
            const { data: c, error: errC } = await supabase.from('companies').insert([{ name: cn }]).select().single(); if (errC) throw errC;
            await supabase.from('user_profiles').insert([{ id: a.user.id, company_id: c.id, role: 'admin' }]);
            await supabase.from('branches').insert([{ company_id: c.id, name: bn }]);
            const { error } = await supabase.from('wallets').insert([{ company_id: currentCompanyId, name: name, type: type, balance: 0 }]);
if (error) return alert(error.message);
        } else { const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw }); if (error) throw error; }
        await checkSession();
    } catch(e) { alert(e.message); }
};
document.getElementById('logoutBtn').onclick = async () => { await supabase.auth.signOut(); await checkSession(); };

// الأصناف والعملاء
async function loadProducts() { const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false }); document.getElementById('productsTable').innerHTML = (data||[]).map(p => `<tr><td class="p-4 font-bold">${p.name}</td><td class="p-4 text-blue-400">${Number(p.selling_price).toFixed(2)}</td><td class="p-4">${p.current_stock || 0}</td></tr>`).join(''); }
async function addProduct() { await supabase.from('products').insert([{ name: document.getElementById('pName').value, cost_price: +document.getElementById('pBuy').value, selling_price: +document.getElementById('pSell').value, current_stock: +document.getElementById('pStock').value, company_id: currentCompanyId }]); closeModal(); loadProducts(); }
function openModal() { document.getElementById('productModal').classList.replace('hidden','flex'); }
function closeModal() { document.getElementById('productModal').classList.replace('flex','hidden'); }

async function loadCustomers() { const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false }); document.getElementById('customersTable').innerHTML = (data||[]).map(c => `<tr><td class="p-4 font-bold">${c.name}</td><td class="p-4">${c.phone || '-'}</td><td class="p-4 font-bold ${c.balance>0?'text-green-400':'text-red-400'}">${Number(c.balance).toFixed(2)}</td></tr>`).join(''); }
async function addCustomer() { await supabase.from('customers').insert([{ name: document.getElementById('cName').value, phone: document.getElementById('cPhone').value, balance: 0, company_id: currentCompanyId }]); closeCustomerModal(); loadCustomers(); }
function openCustomerModal() { document.getElementById('customerModal').classList.replace('hidden','flex'); }
function closeCustomerModal() { document.getElementById('customerModal').classList.replace('flex','hidden'); }

// المبيعات
async function loadInvoiceData() {
    const { data: c } = await supabase.from('customers').select('*'); allCustomers = c || [];
    document.getElementById('invoiceCustomer').innerHTML = '<option value="">اختر العميل</option>' + allCustomers.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    const { data: p } = await supabase.from('products').select('*'); allProducts = p || [];
    document.getElementById('itemProduct').innerHTML = '<option value="">اختر الصنف</option>' + allProducts.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}
function addItemToInvoice() { const pid = document.getElementById('itemProduct').value, qty = +document.getElementById('itemQty').value; if(!pid || qty<1) return; const prod = allProducts.find(p => p.id === pid); const ex = invoiceItems.find(i => i.product_id === pid); if(ex) ex.quantity += qty; else invoiceItems.push({ product_id: pid, name: prod.name, price: +prod.selling_price, quantity: qty }); renderInvoiceTable(); }
function renderInvoiceTable() { let total = 0; document.getElementById('invoiceItemsTable').innerHTML = invoiceItems.map((item, i) => { total += item.price * item.quantity; return `<tr><td class="p-2">${item.name}</td><td class="p-2">${item.quantity}</td><td class="p-2">${(item.price*item.quantity).toFixed(2)}</td><td class="p-2 text-red-400" onclick="invoiceItems.splice(${i},1);renderInvoiceTable()">حذف</td></tr>`; }).join(''); document.getElementById('invoiceTotal').innerText = total.toFixed(2); }

function addPaymentToInvoice() {
    const method = document.getElementById('payMethod').value, amount = +document.getElementById('payAmount').value, ref = document.getElementById('payRef').value;
    if(amount <= 0) return alert('ادخل مبلغ صحيح!');
    invoicePayments.push({ method, amount, ref });
    renderInvoicePayments();
    document.getElementById('payAmount').value = ''; document.getElementById('payRef').value = '';
}
function renderInvoicePayments() {
    let totalPaid = 0;
    document.getElementById('paymentsList').innerHTML = invoicePayments.map((p, i) => {
        totalPaid += p.amount;
        const names = { cash: 'كاش', instapay: 'إنستاباي', wallet: 'محفظة', cheque: 'شيك', bank_transfer: 'تحويل' };
        return `<tr><td>${names[p.method]}</td><td>${p.amount.toFixed(2)}</td><td class="text-red-400" onclick="invoicePayments.splice(${i},1);renderInvoicePayments()">حذف</td></tr>`;
    }).join('');
    document.getElementById('totalPaid').innerText = totalPaid.toFixed(2);
}

async function saveInvoice() {
    const cid = document.getElementById('invoiceCustomer').value;
    if(!cid || !invoiceItems.length) return alert('اختر عميل وأصناف!');
    const total = invoiceItems.reduce((s, i) => s + (i.price*i.quantity), 0);
    const totalPaid = invoicePayments.reduce((s, p) => s + p.amount, 0);
    const { data: inv, error: errInv } = await supabase.from('invoices').insert([{ company_id: currentCompanyId, customer_id: cid, type: 'sale', total_amount: total, paid_amount: totalPaid, status: totalPaid >= total ? 'paid' : 'partial' }]).select().single(); 
    if (errInv) return alert(errInv.message);
    const { error: errItems } = await supabase.from('invoice_items').insert(invoiceItems.map(i => ({ invoice_id: inv.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.price, total: i.price*i.quantity }))); 
    if (errItems) return alert(errItems.message);
    if(invoicePayments.length > 0) {
        const paymentRecords = invoicePayments.map(p => ({ company_id: currentCompanyId, invoice_id: inv.id, amount: p.amount, payment_method: p.method, reference_number: p.ref || null }));
        const { error: errPay } = await supabase.from('payments').insert(paymentRecords);
        if(errPay) return alert(errPay.message);
    }
    for(let item of invoiceItems) { const p = allProducts.find(x => x.id === item.product_id); await supabase.from('products').update({ current_stock: (+p.current_stock) - item.quantity }).eq('id', item.product_id); }
    alert('✅ تم حفظ الفاتورة والدفعات بنجاح!'); invoiceItems = []; invoicePayments = []; renderInvoiceTable(); renderInvoicePayments(); loadInvoiceData();
}
function printLastInvoice() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); const customer = document.getElementById('invoiceCustomer'); const customerName = customer.options[customer.selectedIndex]?.text || 'عميل نقدي'; doc.setFontSize(22); doc.text("Invoice / فاتورة", 105, 20, null, null, "center"); doc.setFontSize(12); doc.text("Customer: " + customerName, 10, 40); doc.text("Date: " + new Date().toLocaleDateString(), 10, 50); let y = 70; doc.text("Item", 10, y); doc.text("Qty", 80, y); doc.text("Price", 110, y); doc.text("Total", 160, y); doc.line(10, y+2, 200, y+2); y += 10; invoiceItems.forEach(item => { doc.text(item.name, 10, y); doc.text(item.quantity.toString(), 80, y); doc.text(item.price.toFixed(2), 110, y); doc.text((item.price * item.quantity).toFixed(2), 160, y); y += 10; }); doc.text("Total: " + document.getElementById('invoiceTotal').innerText, 160, y + 10); doc.save("Invoice.pdf"); }

// دفعات العملاء
async function loadCustomerPayments() { const { data: c } = await supabase.from('customers').select('*'); document.getElementById('payCustomer').innerHTML = '<option value="">اختر العميل</option>' + (c||[]).map(x => `<option value="${x.id}">${x.name}</option>`).join(''); }
async function saveCustomerPayment() {
    const cid = document.getElementById('payCustomer').value, amt = +document.getElementById('payCustomerAmount').value, method = document.getElementById('payCustomerMethod').value;
    if(!cid || amt <= 0) return alert('اختر العميل والمبلغ!');
    await supabase.from('payments').insert([{ company_id: currentCompanyId, customer_id: cid, amount: amt, payment_method: method }]);
    const { data: cust } = await supabase.from('customers').select('balance').eq('id', cid).single();
    await supabase.from('customers').update({ balance: (+cust.balance) - amt }).eq('id', cid);
    const { data: wallet } = await supabase.from('wallets').select('id, balance').eq('company_id', currentCompanyId).eq('type', 'cash').single();
    if(wallet) { await supabase.from('wallets').update({ balance: (+wallet.balance) + amt }).eq('id', wallet.id); await supabase.from('transactions').insert([{ company_id: currentCompanyId, wallet_id: wallet.id, type: 'deposit', amount: amt, description: 'دفعة من عميل' }]); }
    alert('تم تسجيل الدفعة!'); document.getElementById('payCustomerAmount').value='';
}

// المشتريات ودفعات الموردين
async function loadPurchases() { const { data } = await supabase.from('purchase_invoices').select('*').order('created_at', { ascending: false }); document.getElementById('purchasesTable').innerHTML = (data||[]).map(p => `<tr><td class="p-4">${Number(p.total_amount).toFixed(2)}</td><td class="p-4 text-green-400">${Number(p.paid_amount).toFixed(2)}</td></tr>`).join(''); }
async function savePurchase() { await supabase.from('purchase_invoices').insert([{ company_id: currentCompanyId, total_amount: +document.getElementById('purchTotal').value, paid_amount: +document.getElementById('purchPaid').value }]); loadPurchases(); }
async function loadSupplierPayments() { const { data: s } = await supabase.from('suppliers').select('*'); document.getElementById('paySupplier').innerHTML = '<option value="">اختر المورد</option>' + (s||[]).map(x => `<option value="${x.id}">${x.name}</option>`).join(''); }
async function saveSupplierPayment() {
    const sid = document.getElementById('paySupplier').value, amt = +document.getElementById('paySupplierAmount').value, method = document.getElementById('paySupplierMethod').value;
    if(!sid || amt <= 0) return alert('اختر المورد والمبلغ!');
    await supabase.from('payments').insert([{ company_id: currentCompanyId, supplier_id: sid, amount: amt, payment_method: method }]);
    const { data: wallet } = await supabase.from('wallets').select('id, balance').eq('company_id', currentCompanyId).eq('type', 'cash').single();
    if(wallet) { await supabase.from('wallets').update({ balance: (+wallet.balance) - amt }).eq('id', wallet.id); await supabase.from('transactions').insert([{ company_id: currentCompanyId, wallet_id: wallet.id, type: 'withdraw', amount: amt, description: 'دفعة لمورد' }]); }
    alert('تم تسجيل الدفعة!'); document.getElementById('paySupplierAmount').value='';
}

// الشيكات والخزينة والمرتجعات
async function loadCheques() { const { data } = await supabase.from('cheques').select('*').order('created_at', { ascending: false }); document.getElementById('chequesTable').innerHTML = (data||[]).map(c => `<tr><td class="p-4">${c.type === 'incoming' ? 'وارد' : 'صادر'}</td><td class="p-4 font-bold">${Number(c.amount).toFixed(2)}</td><td class="p-4">${c.due_date || '-'}</td></tr>`).join(''); }
async function saveCheque() { await supabase.from('cheques').insert([{ company_id: currentCompanyId, type: document.getElementById('chequeType').value, amount: +document.getElementById('chequeAmount').value, due_date: document.getElementById('chequeDate').value || null }]); loadCheques(); }

async function loadWallets() { 
    const { data } = await supabase.from('wallets').select('*').eq('company_id', currentCompanyId); 
    allWallets = data || []; 
    document.getElementById('txWallet').innerHTML = allWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join(''); 
    document.getElementById('walletBalances').innerHTML = allWallets.map(w => `<div class="flex justify-between p-3 bg-slate-900 rounded border border-slate-700"><span>${w.name}</span><span class="font-bold ${w.balance>0?'text-green-400':'text-slate-400'}">${Number(w.balance).toFixed(2)} ج.م</span></div>`).join(''); 
}

async function addNewWallet() {
    const name = document.getElementById('newWalletName').value.trim();
    const type = document.getElementById('newWalletType').value;
    if(!name) return alert('اكتب اسم المحفظة!');
    await supabase.from('wallets').insert([{ company_id: currentCompanyId, name: name, type: type, balance: 0 }]);
    document.getElementById('newWalletName').value = '';
    loadWallets();
}

async function addTransaction() {
    const wid = document.getElementById('txWallet').value, type = document.getElementById('txType').value, amt = +document.getElementById('txAmount').value, desc = document.getElementById('txDesc').value, target = document.getElementById('txTargetWallet').value;
    if(!wid || amt <= 0) return alert('أكمل البيانات!');
    await supabase.from('transactions').insert([{ company_id: currentCompanyId, wallet_id: wid, type: type, amount: amt, description: desc }]);
    const w = allWallets.find(x => x.id === wid);
    if(type === 'transfer') { await supabase.from('transactions').insert([{ company_id: currentCompanyId, wallet_id: target, type: 'transfer_in', amount: amt, description: 'تحويل من ' + w.name }]); const tw = allWallets.find(x => x.id === target); await supabase.from('wallets').update({ balance: (+w.balance) - amt }).eq('id', wid); await supabase.from('wallets').update({ balance: (+tw.balance) + amt }).eq('id', target); } else { const newBal = (type === 'deposit' || type === 'external_in') ? (+w.balance + amt) : (+w.balance - amt); await supabase.from('wallets').update({ balance: newBal }).eq('id', wid); }
    loadWallets(); document.getElementById('txAmount').value=''; document.getElementById('txDesc').value='';
}
document.getElementById('txType').onchange = (e) => { const tw = document.getElementById('txTargetWallet'); if(e.target.value === 'transfer') { tw.classList.remove('hidden'); tw.innerHTML = allWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join(''); } else { tw.classList.add('hidden'); } };

async function loadReturnInvoices() { const { data: inv } = await supabase.from('invoices').select('id, total_amount').eq('type', 'sale'); document.getElementById('returnInvoiceId').innerHTML = '<option value="">اختر الفاتورة</option>' + (inv||[]).map(i => `<option value="${i.id}">فاتورة ${i.id.slice(0,8)} - ${i.total_amount} ج.م</option>`).join(''); const { data: prod } = await supabase.from('products').select('*'); document.getElementById('returnProductId').innerHTML = '<option value="">اختر الصنف</option>' + (prod||[]).map(p => `<option value="${p.id}">${p.name}</option>`).join(''); }
async function processReturn() { const invId = document.getElementById('returnInvoiceId').value, prodId = document.getElementById('returnProductId').value, qty = +document.getElementById('returnQty').value; if(!invId || !prodId || qty < 1) return alert('اختر الفاتورة والصنف والكمية!'); const { data: ret, error: errInv } = await supabase.from('invoices').insert([{ company_id: currentCompanyId, customer_id: null, type: 'sale_return', total_amount: 0, paid_amount: 0, status: 'paid' }]).select().single(); if(errInv) return alert(errInv.message); const { error: errItem } = await supabase.from('invoice_items').insert([{ invoice_id: ret.id, product_id: prodId, quantity: qty, unit_price: 0, total: 0 }]); if(errItem) return alert(errItem.message); const { data: product } = await supabase.from('products').select('current_stock').eq('id', prodId).single(); await supabase.from('products').update({ current_stock: (+product.current_stock) + qty }).eq('id', prodId); alert('✅ تم تسجيل المرتجع، والمخزون اتحدث!'); }

async function loadReports() { const { data: inv } = await supabase.from('invoices').select('total_amount'); document.getElementById('reportSales').innerText = (inv||[]).reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2); const { data: prod } = await supabase.from('products').select('current_stock, selling_price'); document.getElementById('reportStock').innerText = (prod||[]).reduce((s, p) => s + (Number(p.current_stock) * Number(p.selling_price)), 0).toFixed(2); const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true }); document.getElementById('reportCustomers').innerText = count || 0; }
async function addEmployee() { await supabase.from('employees').insert([{ name: document.getElementById('empName').value, role: document.getElementById('empRole').value, company_id: currentCompanyId }]); alert('تم الحفظ'); document.getElementById('empName').value=''; }

checkSession();
