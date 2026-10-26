// ==========================================
// 1. الإعدادات الأساسية
// ==========================================
const SUPABASE_URL = 'https://wjdhikxuwootmsnztmgb.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_6JNfXXpQLxlxSdyF4XWKng_ZYaNccSE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentCompanyId = null;
let currentUserId = null;
let invoiceItems = [], invoicePayments = [], allProducts = [], allCustomers = [], allWallets = [];

// ==========================================
// 2. عناصر الواجهة
// ==========================================
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const userEmailSpan = document.getElementById('userEmail');

// ==========================================
// 3. دالة التنقل بين الصفحات
// ==========================================
function showPage(pageId, element) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if(page) page.classList.add('active');

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('bg-slate-700','text-blue-400','border-r-4','border-blue-500'));
    if(element) element.classList.add('bg-slate-700','text-blue-400','border-r-4','border-blue-500');
    
    const titles = { 'home': 'الرئيسية', 'inventory': 'المخزون', 'customers': 'العملاء', 'sales': 'المبيعات', 'customer-payments': 'دفعات العملاء', 'purchases': 'المشتريات', 'supplier-payments': 'دفعات الموردين', 'returns': 'المرتجعات', 'cheques': 'الشيكات', 'cash': 'الخزينة', 'employees': 'الموظفين', 'reports': 'التقارير' };
    document.getElementById('pageTitle').innerText = titles[pageId] || 'لوحة التحكم';
    
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

// ==========================================
// 4. نظام الجلسة والشركة (المحسّن)
// ==========================================
async function initSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if(!session) {
            loginScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
            return;
        }

        // المستخدم مسجل دخول
        currentUserId = session.user.id;
        userEmailSpan.innerText = session.user.email;
        
        // إخفاء شاشة الدخول وإظهار لوحة التحكم
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');

        // محاولة جلب الشركة
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('company_id')
            .eq('id', currentUserId)
            .maybeSingle();

        if (profile && profile.company_id) {
            currentCompanyId = profile.company_id;
        } else {
            // لو مفيش شركة، نعمل واحدة جديدة
            const { data: newCompany, error: companyError } = await supabase
                .from('companies')
                .insert([{ name: 'شركتي' }])
                .select()
                .single();

            if (newCompany) {
                currentCompanyId = newCompany.id;
                await supabase.from('user_profiles').upsert([{ 
                    id: currentUserId, 
                    company_id: newCompany.id, 
                    role: 'admin' 
                }]);
                
                // إنشاء محافظ افتراضية
                await supabase.from('wallets').insert([
                    { company_id: currentCompanyId, name: 'الخزينة النقدية', type: 'cash', balance: 0 },
                    { company_id: currentCompanyId, name: 'إنستاباي', type: 'bank', balance: 0 }
                ]);
            }
        }
    } catch(err) {
        console.error("Session error:", err);
        alert("حدث خطأ في تحميل البيانات، يرجى تحديث الصفحة.");
    }
}

// ==========================================
// 5. تسجيل الدخول والتسجيل
// ==========================================
document.getElementById('toggleRegisterBtn').onclick = () => {
    const fields = document.getElementById('companyFields');
    fields.classList.toggle('hidden');
    document.getElementById('loginBtn').innerText = fields.classList.contains('hidden') ? 'دخول' : 'إنشاء شركة ودخول';
};

document.getElementById('loginBtn').onclick = async () => {
    const em = document.getElementById('email').value;
    const pw = document.getElementById('password').value;
    if(!em || !pw) return alert('اكتب الإيميل والباسورد!');
    
    try {
        const isRegister = !document.getElementById('companyFields').classList.contains('hidden');
        
        if(isRegister) {
            const cn = document.getElementById('companyName').value;
            const bn = document.getElementById('branchName').value;
            
            const { data: authData, error: authError } = await supabase.auth.signUp({ email: em, password: pw });
            if(authError) throw authError;

            const { data: compData, error: compError } = await supabase.from('companies').insert([{ name: cn }]).select().single();
            if(compError) throw compError;

            await supabase.from('user_profiles').insert([{ 
                id: authData.user.id, 
                company_id: compData.id, 
                role: 'admin' 
            }]);
            
            await supabase.from('branches').insert([{ company_id: compData.id, name: bn }]);
            await supabase.from('wallets').insert([
                { company_id: compData.id, name: 'الخزينة النقدية', type: 'cash', balance: 0 },
                { company_id: compData.id, name: 'إنستاباي', type: 'bank', balance: 0 }
            ]);
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
            if(error) throw error;
        }
        
        await initSession();
    } catch(e) {
        alert('خطأ: ' + e.message);
    }
};

document.getElementById('logoutBtn').onclick = async () => {
    await supabase.auth.signOut();
    await initSession();
};

// ==========================================
// 6. الأصناف والعملاء
// ==========================================
async function loadProducts() {
    const { data } = await supabase.from('products').select('*').eq('company_id', currentCompanyId).order('created_at', { ascending: false });
    document.getElementById('productsTable').innerHTML = (data||[]).map(p => `<tr><td class="p-4 font-bold">${p.name}</td><td class="p-4 text-blue-400">${Number(p.selling_price).toFixed(2)}</td><td class="p-4">${p.current_stock || 0}</td></tr>`).join('');
}

async function addProduct() {
    const { error } = await supabase.from('products').insert([{
        name: document.getElementById('pName').value,
        cost_price: +document.getElementById('pBuy').value || 0,
        selling_price: +document.getElementById('pSell').value || 0,
        current_stock: +document.getElementById('pStock').value || 0,
        company_id: currentCompanyId
    }]);
    if(error) alert(error.message);
    else { closeModal(); loadProducts(); }
}

function openModal() { document.getElementById('productModal').classList.replace('hidden','flex'); }
function closeModal() { document.getElementById('productModal').classList.replace('flex','hidden'); }

async function loadCustomers() {
    const { data } = await supabase.from('customers').select('*').eq('company_id', currentCompanyId).order('created_at', { ascending: false });
    document.getElementById('customersTable').innerHTML = (data||[]).map(c => `<tr><td class="p-4 font-bold">${c.name}</td><td class="p-4">${c.phone || '-'}</td><td class="p-4 font-bold ${c.balance>0?'text-green-400':'text-red-400'}">${Number(c.balance).toFixed(2)}</td></tr>`).join('');
}

async function addCustomer() {
    const { error } = await supabase.from('customers').insert([{
        name: document.getElementById('cName').value,
        phone: document.getElementById('cPhone').value,
        balance: 0,
        company_id: currentCompanyId
    }]);
    if(error) alert(error.message);
    else { closeCustomerModal(); loadCustomers(); }
}

function openCustomerModal() { document.getElementById('customerModal').classList.replace('hidden','flex'); }
function closeCustomerModal() { document.getElementById('customerModal').classList.replace('flex','hidden'); }

// ==========================================
// 7. المبيعات والدفع المتعدد
// ==========================================
async function loadInvoiceData() {
    const { data: c } = await supabase.from('customers').select('*').eq('company_id', currentCompanyId); 
    allCustomers = c || [];
    document.getElementById('invoiceCustomer').innerHTML = '<option value="">اختر العميل</option>' + allCustomers.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    
    const { data: p } = await supabase.from('products').select('*').eq('company_id', currentCompanyId); 
    allProducts = p || [];
    document.getElementById('itemProduct').innerHTML = '<option value="">اختر الصنف</option>' + allProducts.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}

function addItemToInvoice() {
    const pid = document.getElementById('itemProduct').value;
    const qty = +document.getElementById('itemQty').value;
    if(!pid || qty < 1) return;
    
    const prod = allProducts.find(p => p.id === pid);
    const ex = invoiceItems.find(i => i.product_id === pid);
    
    if(ex) ex.quantity += qty;
    else invoiceItems.push({ product_id: pid, name: prod.name, price: +prod.selling_price, quantity: qty });
    
    renderInvoiceTable();
}

function renderInvoiceTable() {
    let total = 0;
    document.getElementById('invoiceItemsTable').innerHTML = invoiceItems.map((item, i) => {
        total += item.price * item.quantity;
        return `<tr><td class="p-2">${item.name}</td><td class="p-2">${item.quantity}</td><td class="p-2">${(item.price*item.quantity).toFixed(2)}</td><td class="p-2 text-red-400 cursor-pointer" onclick="invoiceItems.splice(${i},1);renderInvoiceTable()">حذف</td></tr>`;
    }).join('');
    document.getElementById('invoiceTotal').innerText = total.toFixed(2);
}

function addPaymentToInvoice() {
    const method = document.getElementById('payMethod').value;
    const amount = +document.getElementById('payAmount').value;
    const ref = document.getElementById('payRef').value;
    
    if(amount <= 0) return alert('ادخل مبلغ صحيح!');
    
    invoicePayments.push({ method, amount, ref });
    renderInvoicePayments();
    
    document.getElementById('payAmount').value = '';
    document.getElementById('payRef').value = '';
}

function renderInvoicePayments() {
    let totalPaid = 0;
    const names = { cash: 'كاش', instapay: 'إنستاباي', wallet: 'محفظة', cheque: 'شيك', bank_transfer: 'تحويل' };
    
    document.getElementById('paymentsList').innerHTML = invoicePayments.map((p, i) => {
        totalPaid += p.amount;
        return `<tr><td>${names[p.method]}</td><td>${p.amount.toFixed(2)}</td><td class="text-red-400 cursor-pointer" onclick="invoicePayments.splice(${i},1);renderInvoicePayments()">حذف</td></tr>`;
    }).join('');
    
    document.getElementById('totalPaid').innerText = totalPaid.toFixed(2);
}

async function saveInvoice() {
    const cid = document.getElementById('invoiceCustomer').value;
    if(!cid || !invoiceItems.length) return alert('اختر عميل وأصناف!');
    
    const total = invoiceItems.reduce((s, i) => s + (i.price*i.quantity), 0);
    const totalPaid = invoicePayments.reduce((s, p) => s + p.amount, 0);
    
    const { data: inv, error: errInv } = await supabase.from('invoices').insert([{ 
        company_id: currentCompanyId, 
        customer_id: cid, 
        type: 'sale', 
        total_amount: total, 
        paid_amount: totalPaid, 
        status: totalPaid >= total ? 'paid' : 'partial' 
    }]).select().single();
    
    if(errInv) return alert(errInv.message);
    
    await supabase.from('invoice_items').insert(invoiceItems.map(i => ({ 
        invoice_id: inv.id, 
        product_id: i.product_id, 
        quantity: i.quantity, 
        unit_price: i.price, 
        total: i.price*i.quantity 
    })));
    
    if(invoicePayments.length > 0) {
        await supabase.from('payments').insert(invoicePayments.map(p => ({ 
            company_id: currentCompanyId, 
            invoice_id: inv.id, 
            amount: p.amount, 
            payment_method: p.method, 
            reference_number: p.ref || null 
        })));
    }
    
    for(let item of invoiceItems) {
        const p = allProducts.find(x => x.id === item.product_id);
        await supabase.from('products').update({ current_stock: (+p.current_stock) - item.quantity }).eq('id', item.product_id);
    }
    
    alert('✅ تم حفظ الفاتورة والدفعات!');
    invoiceItems = [];
    invoicePayments = [];
    renderInvoiceTable();
    renderInvoicePayments();
    loadInvoiceData();
}

function printLastInvoice() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Invoice", 10, 10);
    doc.save("Invoice.pdf");
}

// ==========================================
// 8. الخزينة والمحافظ (المحسّنة)
// ==========================================
async function loadWallets() {
    if (!currentCompanyId) {
        // محاولة إعادة تحميل الشركة
        await initSession();
        if (!currentCompanyId) return; // لسه مفيش شركة
    }

    const { data } = await supabase.from('wallets').select('*').eq('company_id', currentCompanyId);
    allWallets = data || [];
    
    document.getElementById('txWallet').innerHTML = allWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    document.getElementById('walletBalances').innerHTML = allWallets.map(w => `
        <div class="flex justify-between p-3 bg-slate-900 rounded border border-slate-700">
            <span>${w.name}</span>
            <span class="font-bold ${w.balance > 0 ? 'text-green-400' : 'text-slate-400'}">${Number(w.balance).toFixed(2)} ج.م</span>
        </div>
    `).join('');
}

async function addNewWallet() {
    const name = document.getElementById('newWalletName').value.trim();
    const type = document.getElementById('newWalletType').value;
    
    if(!name) return alert('اكتب اسم المحفظة!');
    
    // إذا لم تكن الشركة محملة، نحملها أولاً
    if(!currentCompanyId) {
        await initSession();
        if(!currentCompanyId) return alert('جاري تحميل بيانات الشركة، يرجى المحاولة مرة أخرى');
    }

    const { error } = await supabase.from('wallets').insert([{ 
        company_id: currentCompanyId, 
        name: name, 
        type: type, 
        balance: 0 
    }]);

    if(error) {
        alert('خطأ: ' + error.message);
    } else {
        document.getElementById('newWalletName').value = '';
        loadWallets();
    }
}

async function addTransaction() {
    const wid = document.getElementById('txWallet').value;
    const type = document.getElementById('txType').value;
    const amt = +document.getElementById('txAmount').value;
    const desc = document.getElementById('txDesc').value;
    const target = document.getElementById('txTargetWallet').value;

    if(!wid || amt <= 0) return alert('أكمل البيانات!');
    
    await supabase.from('transactions').insert([{ 
        company_id: currentCompanyId, 
        wallet_id: wid, 
        type: type, 
        amount: amt, 
        description: desc 
    }]);
    
    const w = allWallets.find(x => x.id === wid);

    if(type === 'transfer') {
        await supabase.from('transactions').insert([{ 
            company_id: currentCompanyId, 
            wallet_id: target, 
            type: 'transfer_in', 
            amount: amt, 
            description: 'تحويل من ' + w.name 
        }]);
        const tw = allWallets.find(x => x.id === target);
        await supabase.from('wallets').update({ balance: (+w.balance) - amt }).eq('id', wid);
        await supabase.from('wallets').update({ balance: (+tw.balance) + amt }).eq('id', target);
    } else {
        const newBal = (type === 'deposit') ? (+w.balance + amt) : (+w.balance - amt);
        await supabase.from('wallets').update({ balance: newBal }).eq('id', wid);
    }
    
    loadWallets();
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
}

document.getElementById('txType').onchange = (e) => {
    const tw = document.getElementById('txTargetWallet');
    if(e.target.value === 'transfer') {
        tw.classList.remove('hidden');
        tw.innerHTML = allWallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    } else {
        tw.classList.add('hidden');
    }
};

// ==========================================
// 9. باقي الدوال (placeholder)
// ==========================================
async function loadCustomerPayments() { const { data: c } = await supabase.from('customers').select('*').eq('company_id', currentCompanyId); document.getElementById('payCustomer').innerHTML = '<option value="">اختر العميل</option>' + (c||[]).map(x => `<option value="${x.id}">${x.name}</option>`).join(''); }
async function saveCustomerPayment() { alert('تم الحفظ'); }
async function loadPurchases() { }
async function savePurchase() { }
async function loadSupplierPayments() { }
async function saveSupplierPayment() { }
async function loadCheques() { }
async function saveCheque() { }
async function loadReturnInvoices() { }
async function processReturn() { }
async function loadReports() { }
async function addEmployee() { }

// ==========================================
// 10. تشغيل التطبيق
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initSession();
});
