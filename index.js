// ================================================================
//  🌿 Naseem v4.0 — ZAHRA Automation
//  Twilio WhatsApp Sandbox — بدون QR Code
// ================================================================

const express = require("express");
const axios   = require("axios");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const GAS_URL       = process.env.GAS_URL;
const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM   = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const PORT          = process.env.PORT || 3000;

// تخزين المحادثات في الذاكرة
const sessions = {};
const MAX_HIST = 8;

// ── إرسال رسالة واتساب عبر Twilio ────────────────────────────
async function sendWhatsApp(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  await axios.post(url,
    new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
    { auth: { username: TWILIO_SID, password: TWILIO_TOKEN } }
  );
}

// ── استقبال الرسائل من Twilio Webhook ────────────────────────
app.post("/webhook", async (req, res) => {
  // رد فوري لـ Twilio لتجنب Timeout
  res.set("Content-Type", "text/xml");
  res.send("<Response></Response>");

  const from = req.body.From || "";
  const body = (req.body.Body || "").trim();

  if (!from || !body) return;
  console.log(`📩 [${from}]: ${body}`);

  if (!sessions[from]) sessions[from] = [];
  const history = sessions[from];

  try {
    const response = await axios.post(GAS_URL, {
      source:  "WhatsApp",
      userId:  from,
      message: body,
      history: history
    }, { timeout: 25000 });

    const { reply, bookingData } = response.data;
    if (!reply) return;

    // إرسال الرد
    await sendWhatsApp(from, reply);
    console.log(`📤 [نسيم → ${from}]: ${reply.substring(0, 80)}`);

    // تحديث التاريخ
    history.push({ role: "user",  text: body  });
    history.push({ role: "model", text: reply });
    if (history.length > MAX_HIST * 2) {
      sessions[from] = history.slice(-MAX_HIST * 2);
    }

    // رسالة تأكيد الحجز
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
      await sendWhatsApp(from, confirmation);
    }

  } catch (err) {
    console.error("❌ خطأ:", err.message);
    try {
      await sendWhatsApp(from, "عذراً، حدث خلل مؤقت. حاول بعد قليل! 🙏");
    } catch (_) {}
  }
});

// ── فحص الصحة ────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:   "🌿 Naseem v4.0 Running",
    twilio:   TWILIO_SID ? "✅ Configured" : "❌ Missing",
    gas_url:  GAS_URL    ? "✅ Configured" : "❌ Missing",
    sessions: Object.keys(sessions).length,
    uptime:   Math.floor(process.uptime()) + "s"
  });
});

// ── تشغيل ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Naseem Twilio Bridge على المنفذ ${PORT}`);
  console.log(`🔗 GAS: ${GAS_URL ? "✅" : "❌ غير محدد!"}`);
  console.log(`📱 Twilio: ${TWILIO_SID ? "✅" : "❌ غير محدد!"}`);
});
