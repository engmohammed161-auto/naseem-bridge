// ================================================================
//  🌿 Naseem WhatsApp Bridge — ZAHRA Automation
//  Node.js + whatsapp-web.js + Express
//  يعمل مجاناً على: Koyeb / Render / Railway
// ================================================================

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const express  = require("express");
const axios    = require("axios");
const qrcode   = require("qrcode-terminal");
const qrcodeLib = require("qrcode");

const app  = express();
app.use(express.json());

// ── متغيرات البيئة ────────────────────────────────────────────
const GAS_URL  = process.env.GAS_URL;   // رابط Web App من Apps Script
const PORT     = process.env.PORT || 3000;

// ── تخزين محادثات المستخدمين في الذاكرة ─────────────────────
// { "966501234567@c.us": [ {role, text}, ... ] }
const sessions = {};
const MAX_HISTORY = 10;

// ── إعداد WhatsApp Client ─────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./auth_data" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ]
  }
});

// ── QR Code ───────────────────────────────────────────────────
let currentQR = null;

client.on("qr", (qr) => {
  currentQR = qr;
  console.log("\n📱 امسح هذا الكود بواتساب:\n");
  qrcode.generate(qr, { small: true });
  console.log("\n🌐 أو افتح: http://localhost:" + PORT + "/qr\n");
});

client.on("authenticated", () => {
  console.log("✅ تم تسجيل الدخول بنجاح!");
  currentQR = null;
});

client.on("auth_failure", (msg) => {
  console.error("❌ فشل المصادقة:", msg);
});

client.on("ready", () => {
  console.log("🌿 نسيم جاهز ويستقبل الرسائل!");
});

client.on("disconnected", (reason) => {
  console.log("⚠️ انقطع الاتصال:", reason);
  setTimeout(() => client.initialize(), 5000);
});

// ── معالجة الرسائل الواردة ────────────────────────────────────
client.on("message", async (msg) => {
  // تجاهل الرسائل الجماعية والحالة والبوتات
  if (msg.isGroupMsg || msg.from === "status@broadcast" || msg.fromMe) return;

  const from    = msg.from;   // مثال: 966501234567@c.us
  const body    = msg.body?.trim();
  if (!body) return;

  console.log(`📩 [${from}]: ${body}`);

  // تجهيز تاريخ المحادثة
  if (!sessions[from]) sessions[from] = [];
  const history = sessions[from];

  try {
    // إرسال "يكتب..." كمؤشر
    await client.sendPresenceAvailable();

    // استدعاء نسيم (GAS)
    const response = await axios.post(GAS_URL, {
      source:  "WhatsApp",
      userId:  from,
      message: body,
      history: history
    }, { timeout: 25000 });

    const { reply, bookingData } = response.data;

    if (!reply) {
      await msg.reply("عذراً، ما قدرت أفهم. ممكن تعيد الرسالة؟ 🙏");
      return;
    }

    // إرسال الرد
    await msg.reply(reply);
    console.log(`📤 [نسيم → ${from}]: ${reply.substring(0, 80)}...`);

    // تحديث التاريخ
    history.push({ role: "user",  text: body  });
    history.push({ role: "model", text: reply });

    // الإبقاء على آخر MAX_HISTORY رسالة فقط
    if (history.length > MAX_HISTORY * 2) {
      sessions[from] = history.slice(-MAX_HISTORY * 2);
    }

    // إشعار الحجز
    if (bookingData) {
      const confirmation =
        `✅ *تأكيد الحجز*\n` +
        `━━━━━━━━━━━━━━\n` +
        `👤 الاسم: ${bookingData.name}\n` +
        `📋 الخدمة: ${bookingData.service}\n` +
        `📅 التاريخ: ${bookingData.date}\n` +
        `⏰ الوقت: ${bookingData.time}\n` +
        `━━━━━━━━━━━━━━\n` +
        `سنتواصل معك للتأكيد النهائي 🌿`;
      await msg.reply(confirmation);
    }

  } catch (err) {
    console.error("❌ خطأ:", err.message);
    await msg.reply("عذراً، حدث خلل مؤقت. حاول مرة ثانية بعد قليل! 🙏");
  }
});

// ── API Endpoints ─────────────────────────────────────────────

// فحص الصحة
app.get("/", (req, res) => {
  res.json({
    status:    "🌿 Naseem Bridge Running",
    whatsapp:  client.info ? "Connected ✅" : "Disconnected ❌",
    sessions:  Object.keys(sessions).length,
    uptime:    Math.floor(process.uptime()) + "s"
  });
});

// عرض QR Code كصورة في المتصفح
app.get("/qr", async (req, res) => {
  if (!currentQR) {
    return res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:50px;background:#f0f7f0">
        <h2>🌿 نسيم</h2>
        <p style="color:green;font-size:20px">✅ واتساب متصل بالفعل!</p>
        <a href="/" style="color:#1a73e8">← العودة للرئيسية</a>
      </body></html>
    `);
  }
  try {
    const qrImage = await qrcodeLib.toDataURL(currentQR);
    res.send(`
      <html><head><meta http-equiv="refresh" content="30"></head>
      <body style="font-family:Arial;text-align:center;padding:30px;background:#f0f7f0">
        <h2>🌿 نسيم — ربط واتساب</h2>
        <p>افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز</p>
        <img src="${qrImage}" style="border:4px solid #1a73e8;border-radius:12px;width:280px"/>
        <p style="color:#888;font-size:13px">تحديث تلقائي كل 30 ثانية</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send("خطأ في توليد QR");
  }
});

// إرسال رسالة يدوي (للاختبار)
app.post("/send", async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: "to و message مطلوبان" });
  try {
    const chatId = to.includes("@") ? to : `${to}@c.us`;
    await client.sendMessage(chatId, message);
    res.json({ success: true, to: chatId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// مسح جلسة مستخدم
app.delete("/session/:userId", (req, res) => {
  const key = req.params.userId;
  delete sessions[key];
  res.json({ success: true, message: `جلسة ${key} تم مسحها` });
});

// ── تشغيل السيرفر ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Naseem Bridge يعمل على المنفذ ${PORT}`);
  console.log(`🔗 GAS URL: ${GAS_URL ? GAS_URL.substring(0, 50) + "..." : "❌ غير محدد!"}`);
  if (!GAS_URL) console.error("⛔ تحذير: GAS_URL غير موجود في متغيرات البيئة!");
});

// تهيئة واتساب
client.initialize();

process.on("SIGTERM", async () => {
  console.log("⏹ إيقاف النظام...");
  await client.destroy();
  process.exit(0);
});

