const SUPABASE_URL = 'https://wjdhikxuwootmsnztmgb.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_6JNfXXpQLxlxSdyF4XWKng_ZYaNccSE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentCompanyId = null, invoiceItems = [], allProducts = [], allCustomers = [], allWallets = [];
let isRegisterMode = false;

// عناصر الشاشة
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const userEmailSpan = document.getElementById('userEmail');

// دالة التنقل
function showPage(pageId, element) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('bg-slate-700','text-blue-400','border-r-4','border-blue-500'));
    if(element) element.classList.add('bg-slate-700','text-blue-400','border-r-4','border-blue-500');
    document.getElementById('pageTitle').innerText = { 'home': 'الرئيسية', 'inventory': 'المخزون', 'customers': 'العملاء', 'sales': 'المبيعات', 'returns': 'المرتجعات', 'cash': 'الخزينة', 'employees': 'الموظفين', 'reports': 'التقارير' }[pageId];
    
    if(pageId === 'inventory') loadProducts();
    if(pageId === 'customers') loadCustomers();
    if(pageId === 'sales') loadInvoiceData();
    if(pageId === 'cash') loadWallets();
    if(pageId === 'reports') loadReports();
}

// جلب الشركة
async function fetchCompany() {
    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
        const { data } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single();
        if(data) currentCompanyId = data.company_id;
    }
}

// تسجيل الدخول
document.getElementById('toggleRegisterBtn').onclick = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById('companyFields').classList.toggle('hidden');
    document.getElementById('loginBtn').innerText = isRegisterMode ? 'إنشاء شركة ودخول' : 'دخول';
};

document.getElementById('loginBtn').onclick = async () => {
    const em = document.getElementById('email').value, pw = document.getElementById('password').value;
    if(!em || !pw) return;
    try {
        if(isRegisterMode) {
            const cn = document.getElementById('companyName').value, bn = document.getElementById('branchName').value;
            const { data: a, error: errA } = await supabase.auth.signUp({ email: em, password: pw });
            if (errA) throw errA;
            const { data: c, error: errC } = await supabase.from('companies').insert([{ name: cn }]).select().single();
            if (errC) throw errC;
            await supabase.from('user_profiles').insert([{ id: a.user.id, company_id: c.id, role: 'admin' }]);
            await supabase.from('branches').insert([{ company_id: c.id, name: bn }]);
            await supabase.from('wallets').insert([{ company_id: c.id, name: 'الخزينة النقدية', type: 'cash', balance: 0 }, { company_id: c.id, name: 'إنستاباي', type: 'bank', balance: 0 }]);
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
            if (error) throw error;
        }
        await checkSession();
    } catch(e) { alert(e.message); }
};

// التحقق من الجلسة
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if(session) { loginScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); userEmailSpan.innerText = session.user.email; await fetchCompany(); }
    else { loginScreen.classList.remove('hidden'); dashboardScreen.classList.add('hidden'); }
}

document.getElementById('logoutBtn').onclick = async () => { await supabase.auth.signOut(); await checkSession(); };

// المنتجات
async function loadProducts() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    document.getElementById('productsTable').innerHTML = (data||[]).map(p => `<tr><td class="p-4 font-bold">${p.name}</td><td class="p-4 text-blue-400">${Number(p.selling_price).toFixed(2)}</td><td class="p-4">${p.current_stock || 0}</td></tr>`).join('');
}
async function addProduct() {
    await supabase.from('products').insert([{ name: document.getElementById('pName').value, cost_price: +document.getElementById('pBuy').value, selling_price: +document.getElementById('pSell').value, current_stock: +document.getElementById('pStock').value, company_id: currentCompanyId }]);
    closeModal(); loadProducts();
}
function openModal() { document.getElementById('productModal').classList.replace('hidden','flex'); }
function closeModal() { document.getElementById('productModal').classList.replace('flex','hidden'); }

// العملاء
async function loadCustomers() {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    document.getElementById('customersTable').innerHTML = (data||[]).map(c => `<tr><td class="p-4 font-bold">${c.name}</td><td class="p-4">${c.phone || '-'}</td><td class="p-4 font-bold ${c.balance>0?'text-green-400':'text-red-400'}">${Number(c.balance).toFixed(2)}</td></tr>`).join('');
}
async function addCustomer() {
    await supabase.from('customers').insert([{ name: document.getElementById('cName').value, phone: document.getElementById('cPhone').value, balance: 0, company_id: currentCompanyId }]);
    closeCustomerModal(); loadCustomers();
}
function openCustomerModal() { document.getElementById('customerModal').classList.replace('hidden','flex'); }
function closeCustomerModal() { document.getElementById('customerModal').classList.replace('flex','hidden'); }

// الفواتير
async function loadInvoiceData() {
    const { data: c } = await supabase.from('customers').select('*'); allCustomers = c || [];
    document.getElementById('invoiceCustomer').innerHTML = '<option value="">اختر العميل</option>' + allCustomers.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    const { data: p } = await supabase.from('products').select('*'); allProducts = p || [];
    document.getElementById('itemProduct').innerHTML = '<option value="">اختر الصنف</option>' + allProducts.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}
function addItemToInvoice() {
    const pid = document.getElementById('itemProduct').value, qty = +document.getElementById('itemQty').value;
    if(!pid || qty<1) return;
    const prod = allProducts.find(p => p.id === pid);
    const ex = invoiceItems.find(i => i.product_id === pid);
    if(ex) ex.quantity += qty; else invoiceItems.push({ product_id: pid, name: prod.name, price: +prod.selling_price, quantity: qty });
    renderInvoiceTable();
}
function renderInvoiceTable() {
    let total = 0;
    document.getElementById('invoiceItemsTable').innerHTML = invoiceItems.map((item, i) => {
        total += item.price * item.quantity;
        return `<tr><td class="p-2">${item.name}</td><td class="p-2">${item.quantity}</td><td class="p-2">${(item.price*item.quantity).toFixed(2)}</td><td class="p-2 text-red-400" onclick="invoiceItems.splice(${i},1);renderInvoiceTable()">حذف</td></tr>`;
    }).join('');
    document.getElementById('invoiceTotal').innerText = total.toFixed(2);
}
async function saveInvoice() {
    const cid = document.getElementById('invoiceCustomer').value, method = document.getElementById('payMethod').value, amt = +document.getElementById('payAmount').value || 0;
    if(!cid || !invoiceItems.length) return alert('اختر عميل وأصناف!');
    const total = invoiceItems.reduce((s, i) => s + (i.price*i.quantity), 0);
    const { data: inv, error: errInv } = await supabase.from('invoices').insert([{ company_id: currentCompanyId, customer_id: cid, type: 'sale', total_amount: total, paid_amount: amt, status: amt>=total?'paid':'partial' }]).select().single();
    if (errInv) return alert(errInv.message);
    const { error: errItems } = await supabase.from('invoice_items').insert(invoiceItems.map(i => ({ invoice_id: inv.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.price, total: i.price*i.quantity })));
    if (errItems) return alert(errItems.message);
    if(amt > 0) await supabase.from('payments').insert([{ company_id: currentCompanyId, invoice_id: inv.id, amount: amt, payment_method: method }]);
    for(let item of invoiceItems) {
        const p = allProducts.find(x => x.id === item.product_id);
        await supabase.from('products').update({ current_stock: (+p.current_stock) - item.quantity }).eq('id', item.product_id);
    }
    alert('✅ تم الحفظ!'); invoiceItems = []; renderInvoiceTable(); loadInvoiceData();
}

// طباعة فاتورة PDF
function printLastInvoice() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Invoice", 10, 10);
    doc.save("invoice.pdf");
    alert('جاري تحميل الفاتورة');
}

// الخزينة
async function loadWallets() {
    const { data } = await supabase.from('wallets').select('*').eq('company_id', currentCompanyId);
    allWallets = data || [];
    document.getElementById('txWallet').innerHTML = allWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    document.getElementById('walletBalances').innerHTML = allWallets.map(w => `<div class="flex justify-between p-3 bg-slate-900 rounded border border-slate-700"><span>${w.name}</span><span class="font-bold ${w.balance>0?'text-green-400':'text-slate-400'}">${Number(w.balance).toFixed(2)} ج.م</span></div>`).join('');
}
async function addTransaction() {
    const wid = document.getElementById('txWallet').value, type = document.getElementById('txType').value, amt = +document.getElementById('txAmount').value, desc = document.getElementById('txDesc').value;
    const target = document.getElementById('txTargetWallet').value;
    if(!wid || amt <= 0) return alert('أكمل البيانات!');
    
    await supabase.from('transactions').insert([{ company_id: currentCompanyId, wallet_id: wid, type: type, amount: amt, description: desc }]);
    const w = allWallets.find(x => x.id === wid);
    
    if(type === 'transfer') {
        await supabase.from('transactions').insert([{ company_id: currentCompanyId, wallet_id: target, type: 'transfer_in', amount: amt, description: 'تحويل من ' + w.name }]);
        const tw = allWallets.find(x => x.id === target);
        await supabase.from('wallets').update({ balance: (+w.balance) - amt }).eq('id', wid);
        await supabase.from('wallets').update({ balance: (+tw.balance) + amt }).eq('id', target);
    } else {
        const newBal = (type === 'deposit' || type === 'external_in') ? (+w.balance + amt) : (+w.balance - amt);
        await supabase.from('wallets').update({ balance: newBal }).eq('id', wid);
    }
    loadWallets(); document.getElementById('txAmount').value=''; document.getElementById('txDesc').value='';
}

// الموظفين
async function addEmployee() {
    await supabase.from('employees').insert([{ name: document.getElementById('empName').value, role: document.getElementById('empRole').value, company_id: currentCompanyId }]);
    alert('تم الحفظ'); document.getElementById('empName').value='';
}

// التقارير
async function loadReports() {
    const { data: inv } = await supabase.from('invoices').select('total_amount');
    document.getElementById('reportSales').innerText = (inv||[]).reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2);
    
    const { data: prod } = await supabase.from('products').select('current_stock, selling_price');
    document.getElementById('reportStock').innerText = (prod||[]).reduce((s, p) => s + (Number(p.current_stock) * Number(p.selling_price)), 0).toFixed(2);
    
    const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    document.getElementById('reportCustomers').innerText = count || 0;
}

// تحويل نوع الحركة
document.getElementById('txType').onchange = (e) => {
    const tw = document.getElementById('txTargetWallet');
    if(e.target.value === 'transfer') {
        tw.classList.remove('hidden');
        tw.innerHTML = allWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    } else {
        tw.classList.add('hidden');
    }
};

// تشغيل الجلسة
checkSession();