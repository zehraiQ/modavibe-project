/* frontend/js/app.js */

let pendingEmail = ""; // لتخزين الإيميل أثناء عملية التحقق

document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
});

// دالة لفتح نافذة التسجيل
function openAuthModal() {
    const modalEl = document.getElementById('authModal');
    if(modalEl) {
        new bootstrap.Modal(modalEl).show();
    } else {
        window.location.href = 'index.html'; 
    }
}

// 1. معالجة التسجيل (يفتح نافذة التحقق)
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;

    if (!email.endsWith('@gmail.com')) {
        alert("Hata: Sadece @gmail.com adresleri kabul edilir!");
        return;
    }

    const data = {
        name: document.getElementById('reg-name').value,
        email: email,
        phone: document.getElementById('reg-phone').value,
        address: document.getElementById('reg-address').value,
        password: document.getElementById('reg-pass').value
    };

    const res = await apiRequest('/register', 'POST', data);

    if (res.message) {
        pendingEmail = res.email;
        
        // إغلاق نافذة التسجيل
        const authModalEl = document.getElementById('authModal');
        const modalInstance = bootstrap.Modal.getInstance(authModalEl);
        if(modalInstance) modalInstance.hide();

        // فتح نافذة التحقق بتأخير بسيط
        setTimeout(() => {
            const verifyModalEl = document.getElementById('verifyModal');
            const verifyModalInstance = new bootstrap.Modal(verifyModalEl);
            verifyModalInstance.show();
        }, 200); 
        
    } else {
        alert(res.error);
    }
}

// 2. معالجة التحقق من الكود
async function submitVerifyCode() {
    const code = document.getElementById('verify-code-input').value;
    const res = await apiRequest('/verify', 'POST', { email: pendingEmail, code: code });

    if (res.message) {
        alert("Hesabınız başarıyla doğrulandı! Giriş yapılıyor...");
        const verifyModalEl = document.getElementById('verifyModal');
        const modalInstance = bootstrap.Modal.getInstance(verifyModalEl);
        if(modalInstance) modalInstance.hide();
        
        setTimeout(() => { openAuthModal(); }, 200);
    } else {
        alert("HATA: " + res.error);
    }
}

// 3. معالجة تسجيل الدخول
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    const res = await apiRequest('/login', 'POST', { email, password });

    if (res.user) {
        localStorage.setItem('user', JSON.stringify(res.user));
        location.reload();
    } else {
        alert(res.error);
    }
}

// ============================================================
// 4. تحديث القائمة العلوية (هنا تم استرجاع البروفايل والطلبات)
// ============================================================
function updateNavbar() {
    const user = JSON.parse(localStorage.getItem('user'));
    const menuArea = document.getElementById('user-menu-area');
    
    if (menuArea) {
        if (user) {
            // رابط الأدمن يظهر فقط للأدمن
            let adminLink = user.role === 'admin' ? `<li><a class="dropdown-item" href="admin.html"><i class="fas fa-cog me-2"></i> Yönetim Paneli</a></li>` : '';
            
            // هنا نضع كود HTML للقائمة المنسدلة كما كان في الـ Index سابقاً
            menuArea.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-outline-dark dropdown-toggle text-uppercase" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-user me-2"></i> ${user.name}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                        <li class="px-3 py-2 small text-muted border-bottom">Merhaba, <b>${user.name}</b></li>
                        
                        ${adminLink}
                        
                        <li><a class="dropdown-item" href="profile.html"><i class="far fa-id-card me-2"></i> Hesabım (Profil)</a></li>
                        
                        <li><a class="dropdown-item" href="orders.html"><i class="fas fa-box-open me-2"></i> Siparişlerim</a></li>
                        
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="logoutUser()"><i class="fas fa-sign-out-alt me-2"></i> Çıkış Yap</a></li>
                    </ul>
                </div>`;
            
            updateCartCount(user.id);
        } else {
            // إذا لم يكن مسجلاً، يظهر زر الدخول
            menuArea.innerHTML = `<button class="btn btn-outline-dark" onclick="openAuthModal()">GİRİŞ YAP</button>`;
        }
    }
}

async function updateCartCount(userId) {
    const res = await apiRequest(`/cart/${userId}`);
    const badge = document.getElementById('cart-count');
    if (res.data && badge) badge.innerText = res.data.length;
}

function logoutUser() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    try {
        const response = await fetch(`/api${endpoint}`, options);
        return await response.json();
    } catch (err) {
        console.error(err);
        return { error: "Sunucu hatası!" };
    }
}