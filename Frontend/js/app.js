/* frontend/js/app.js */

// عند تحميل أي صفحة، نفذ التالي
document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
});

/**
 * دالة تحديث القائمة العلوية
 * تتحقق من وجود المستخدم، وتظهر إما زر الدخول أو قائمة البروفايل
 */
function updateNavbar() {
    const user = JSON.parse(localStorage.getItem('user'));
    const menuArea = document.getElementById('user-menu-area');
    const cartBadge = document.getElementById('cart-count');

    // 1. تحديث منطقة أيقونة المستخدم
    if (menuArea) {
        if (user) {
            // إذا كان المستخدم مسجلاً
            let adminLink = '';
            // نظهر رابط الأدمن فقط إذا كان دوره 'admin'
            if (user.role === 'admin') {
                adminLink = `<li><a class="dropdown-item" href="admin.html"><i class="fas fa-cog me-2"></i> Yönetim Paneli</a></li>`;
            }

            menuArea.innerHTML = `
                <div class="dropdown">
                    <a href="#" class="text-dark fs-5" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-user-check text-success"></i>
                    </a>
                    <ul class="dropdown-menu dropdown-menu-end rounded-0 border-0 shadow" style="min-width: 200px;">
                        <li class="px-3 py-2 small text-muted border-bottom">
                            Merhaba, <b>${user.name}</b>
                        </li>
                        ${adminLink}
                        <li><a class="dropdown-item" href="profile.html"><i class="far fa-id-card me-2"></i> Hesabım</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="logoutUser()"><i class="fas fa-sign-out-alt me-2"></i> Çıkış Yap</a></li>
                    </ul>
                </div>
            `;
        } else {
            // إذا كان ضيفاً (غير مسجل)
            menuArea.innerHTML = `
                <a href="login.html" class="text-dark fs-5" title="Giriş Yap / Üye Ol">
                    <i class="far fa-user"></i>
                </a>
            `;
        }
    }

    // 2. تحديث رقم السلة (اختياري، يطلب من السيرفر العدد)
    if (user && cartBadge) {
        // يمكنك تفعيل هذا السطر إذا أردت جلبه من السيرفر دائماً
        // fetchCartCount(user.id);
        // حالياً سنتركه 0 أو نحدثه عند الإضافة
    }
}

/**
 * دالة تسجيل الخروج
 */
function logoutUser() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

/**
 * دالة الاتصال بالسيرفر (API Helper)
 * تستخدمها جميع الصفحات (Login, Index, Cart, Admin)
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const res = await fetch(`/api${endpoint}`, options);
        return await res.json();
    } catch (err) {
        console.error("API Error:", err);
        return { error: "Sunucu hatası! (Connection Error)" };
    }
}