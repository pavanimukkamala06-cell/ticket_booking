const nodemailer = require('nodemailer');

function createTransporter() {
  // Gmail SMTP — requires EMAIL_USER and EMAIL_PASS (App Password) in .env
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendBookingConfirmation({ to, name, bookingRef, eventTitle, eventDate, eventTime, seats, totalAmount, qrCodeDataUrl }) {
  const transporter = createTransporter();

  const seatList = seats.map(s => `Row ${s.row_label} Seat ${s.seat_number} (${s.category})`).join(', ');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f1a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: white; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; }
    .body { padding: 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #a5b4fc; }
    .info-card { background: #0f0f1a; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #2d2d44; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2d2d44; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #94a3b8; font-size: 13px; }
    .info-value { color: #e2e8f0; font-weight: 600; font-size: 13px; text-align: right; max-width: 60%; }
    .qr-section { text-align: center; padding: 20px; }
    .qr-section img { border: 3px solid #6366f1; border-radius: 12px; padding: 10px; background: white; }
    .qr-label { margin-top: 12px; color: #94a3b8; font-size: 12px; }
    .ref-box { background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; }
    .ref-box span { font-size: 20px; font-weight: 700; letter-spacing: 3px; color: white; }
    .footer { background: #0f0f1a; padding: 20px 30px; text-align: center; color: #64748b; font-size: 12px; }
    .badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎟️ TicketFlow</h1>
      <p>Your booking is confirmed!</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${name}! <span class="badge">✓ CONFIRMED</span></p>
      <p style="color:#94a3b8;">Your seats have been reserved. Please present the QR code below at the venue entrance.</p>

      <div class="ref-box">
        <div style="color:rgba(255,255,255,0.7);font-size:11px;margin-bottom:4px;">BOOKING REFERENCE</div>
        <span>${bookingRef}</span>
      </div>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Event</span>
          <span class="info-value">${eventTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date</span>
          <span class="info-value">${eventDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Time</span>
          <span class="info-value">${eventTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Seats</span>
          <span class="info-value">${seatList}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Paid</span>
          <span class="info-value" style="color:#10b981;">₹${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div class="qr-section">
        <p style="color:#a5b4fc;font-weight:600;margin-bottom:12px;">Scan QR Code at Entry</p>
        <img src="${qrCodeDataUrl}" alt="QR Code" width="200" height="200">
        <p class="qr-label">Encodes your booking reference — ${bookingRef}</p>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated email from TicketFlow. Please do not reply.</p>
      <p>© 2026 TicketFlow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"TicketFlow" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🎟️ Booking Confirmed — ${eventTitle} [${bookingRef}]`,
    html,
  });
}

async function sendWaitlistOffer({ to, name, eventTitle, categoryName, offerLink, expiresInMinutes }) {
  const transporter = createTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f1a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: white; }
    .body { padding: 30px; }
    .cta-btn { display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-align: center; padding: 16px 30px; border-radius: 12px; font-size: 18px; font-weight: 700; text-decoration: none; margin: 30px 0; }
    .warning { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 15px; color: #fca5a5; font-size: 14px; }
    .footer { background: #0f0f1a; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 A Seat is Available!</h1>
      <p style="color:rgba(255,255,255,0.85);">You're next on the waitlist</p>
    </div>
    <div class="body">
      <p>Hi <strong>${name}</strong>,</p>
      <p>Great news! A <strong>${categoryName}</strong> seat for <strong>${eventTitle}</strong> has just become available, and you're next in line on the waitlist.</p>
      <div class="warning">
        ⚠️ <strong>Time-limited offer:</strong> You have <strong>${expiresInMinutes} minutes</strong> to complete your booking. After that, the seat will be offered to the next person in line.
      </div>
      <a href="${offerLink}" class="cta-btn">🎟️ Claim Your Seat Now</a>
      <p style="color:#64748b;font-size:13px;">If the button doesn't work, copy this link:<br><span style="color:#a5b4fc;">${offerLink}</span></p>
    </div>
    <div class="footer">
      <p>© 2026 TicketFlow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"TicketFlow" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🎉 Seat Available for ${eventTitle} — Claim Now!`,
    html,
  });
}

module.exports = { sendBookingConfirmation, sendWaitlistOffer };
