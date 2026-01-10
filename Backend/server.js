/* * File: backend/server.js
 * النسخة النهائية الآمنة (Secured Version)
 */

// 1. استدعاء مكتبة التشفير (يجب أن يكون أول سطر)
require('dotenv').config(); 

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer'); 
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');

const app = express();
// استخدام المنفذ من البيئة (مهم للنشر) أو 3000 محلياً
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// تقديم ملفات الفرونت إند (مهم جداً عند النشر)
app.use(express.static(path.join(__dirname, '../frontend')));

// --- إعدادات رفع الصور ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') 
    },
    filename: function (req, file, cb) {
        // اسم فريد للصورة
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_')); 
    }
});
const upload = multer({ storage: storage });

// جعل مجلد الصور عاماً للوصول إليه
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- قاعدة البيانات ---
const db = new sqlite3.Database('./shop.db', (err) => {
    if (err) console.error(err.message);
    else console.log('✅ Veritabanı Bağlandı (Database Connected).');
});

db.serialize(() => {
    // إنشاء الجداول
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        password TEXT,
        role TEXT DEFAULT 'user',
        is_verified INTEGER DEFAULT 0,
        verification_code TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_tr TEXT, 
        price REAL, 
        image TEXT, 
        category TEXT
    )`);
    //جدول الطلبات
    db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total_price REAL,
    items TEXT,
    address TEXT,
    status TEXT DEFAULT 'Hazırlanıyor',
    date TEXT
)`);
    db.run(`CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        quantity INTEGER
    )`);

    // إنشاء أدمن افتراضي
    const adminCheck = db.prepare("SELECT * FROM users WHERE email = ?");
    adminCheck.get("admin@modavibe.com", async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash("123456", 10);
            const stmt = db.prepare("INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)");
            stmt.run("Admin", "admin@modavibe.com", hashedPassword, "admin", 1);
            console.log('👤 Admin Hesabı Hazır: admin@modavibe.com');
        }
    });
});

// --- إعداد الإيميل (الآمن) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // يقرأ البيانات من ملف .env المخفي
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ================== APIs ==================

// 1. المنتجات
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/products', upload.single('image'), (req, res) => {
    const { name_tr, price, category } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';
    const stmt = db.prepare("INSERT INTO products (name_tr, price, image, category) VALUES (?, ?, ?, ?)");
    stmt.run(name_tr, price, imagePath, category, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Ürün Eklendi!", id: this.lastID });
    });
});

app.put('/api/products/:id', upload.single('image'), (req, res) => {
    const { name_tr, price, category } = req.body;
    let sql, params;
    if (req.file) {
        sql = `UPDATE products SET name_tr=?, price=?, category=?, image=? WHERE id=?`;
        params = [name_tr, price, category, `/uploads/${req.file.filename}`, req.params.id];
    } else {
        sql = `UPDATE products SET name_tr=?, price=?, category=? WHERE id=?`;
        params = [name_tr, price, category, req.params.id];
    }
    db.run(sql, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Ürün Güncellendi!" });
    });
});

app.delete('/api/products/:id', (req, res) => {
    db.run("DELETE FROM cart WHERE product_id = ?", [req.params.id], () => {
        db.run("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Ürün Silindi!" });
        });
    });
});

// 2. التسجيل والتوثيق
app.post('/api/register', (req, res) => {
    const { name, email, phone, address, password } = req.body;
    if(!email || !password || !name) return res.status(400).json({ error: "Eksik bilgi!" });

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
        if (row) return res.status(400).json({ error: "Bu e-posta zaten kayıtlı!" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const stmt = db.prepare("INSERT INTO users (name, email, phone, address, password, verification_code) VALUES (?, ?, ?, ?, ?, ?)");
        stmt.run(name, email, phone, address, hashedPassword, code, function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // إرسال الإيميل
            const mailOptions = {
                from: '"ModaVibe Security" <' + process.env.EMAIL_USER + '>',
                to: email,
                subject: 'ModaVibe Doğrulama Kodu',
                text: `Merhaba ${name},\n\nHesabınızı doğrulamak için kodunuz: ${code}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log("Email Error:", error);
                    // حذف المستخدم إذا فشل الإرسال ليحاول مرة أخرى
                    db.run("DELETE FROM users WHERE email = ?", [email]);
                    return res.status(500).json({ error: "E-posta gönderilemedi." });
                }
                res.json({ message: "Kayıt Başarılı! Kod gönderildi." });
            });
        });
    });
});

app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND verification_code = ?", [email, code], (err, row) => {
        if (!row) return res.status(400).json({ error: "Hatalı kod!" });
        db.run("UPDATE users SET is_verified = 1, verification_code = NULL WHERE id = ?", [row.id], () => {
            res.json({ message: "Hesap Doğrulandı!" });
        });
    });
});

// 3. تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (!user) return res.status(400).json({ error: "Kullanıcı bulunamadı." });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Hatalı şifre." });
        
        if (user.is_verified === 0) return res.status(403).json({ error: "Hesap doğrulanmadı.", needsVerify: true });

        // إرجاع بيانات المستخدم (بدون الباسورد)
        res.json({ 
            message: "Giriş Başarılı", 
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address, role: user.role } 
        });
    });
});

// 4. تحديث البروفايل
app.put('/api/users/:id', (req, res) => {
    const { name, phone, address } = req.body;
    db.run("UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?", 
        [name, phone, address, req.params.id], 
        (err) => {
            if(err) return res.status(500).json({error: err.message});
            res.json({message: "Bilgiler güncellendi!"});
        }
    );
});

// 5. السلة
app.post('/api/cart', (req, res) => {
    const { user_id, product_id } = req.body;
    db.get("SELECT * FROM cart WHERE user_id = ? AND product_id = ?", [user_id, product_id], (err, row) => {
        if (row) {
            db.run("UPDATE cart SET quantity = quantity + 1 WHERE id = ?", [row.id], () => res.json({ message: "Güncellendi" }));
        } else {
            db.run("INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, 1)", [user_id, product_id], () => res.json({ message: "Eklendi" }));
        }
    });
});

app.get('/api/cart/:uid', (req, res) => {
    const sql = `SELECT c.id as cart_id, c.quantity, p.name_tr, p.price, p.image FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`;
    db.all(sql, [req.params.uid], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.delete('/api/cart/:id', (req, res) => {
    db.run("DELETE FROM cart WHERE id = ?", [req.params.id], () => res.json({ message: "Silindi" }));
});
// === API: إتمام الشراء (Checkout) ===
app.post('/api/checkout', (req, res) => {
    const { user_id, address, card_info } = req.body; // card_info شكلي فقط

    // 1. جلب محتويات السلة
    db.all(`SELECT c.quantity, p.name_tr, p.price 
            FROM cart c JOIN products p ON c.product_id = p.id 
            WHERE c.user_id = ?`, [user_id], (err, rows) => {

        if (rows.length === 0) return res.status(400).json({ error: "Sepetiniz boş!" });

        // 2. حساب المجموع وتجهيز قائمة المنتجات كنص
        let total = 0;
        let itemsSummary = [];
        rows.forEach(item => {
            total += item.price * item.quantity;
            itemsSummary.push(`${item.quantity}x ${item.name_tr}`);
        });

        const itemsString = itemsSummary.join(', ');
        const date = new Date().toLocaleDateString('tr-TR');

        // 3. إضافة الطلب إلى جدول orders
        const stmt = db.prepare("INSERT INTO orders (user_id, total_price, items, address, date) VALUES (?, ?, ?, ?, ?)");
        stmt.run(user_id, total, itemsString, address, date, function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // 4. تفريغ السلة بعد نجاح الدفع
            db.run("DELETE FROM cart WHERE user_id = ?", [user_id], () => {
                res.json({ message: "Sipariş başarıyla alındı!" });
            });
        });
    });
});

// === API: جلب طلبات المستخدم السابقة ===
app.get('/api/orders/:uid', (req, res) => {
    db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC", [req.params.uid], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});
// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});