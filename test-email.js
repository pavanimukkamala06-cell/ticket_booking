require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

console.log('EMAIL_USER:', EMAIL_USER);
console.log('EMAIL_PASS:', EMAIL_PASS ? 'SET (' + EMAIL_PASS.length + ' chars)' : 'MISSING');

if (!EMAIL_USER || !EMAIL_PASS) {
  console.error('ERROR: EMAIL_USER or EMAIL_PASS not set in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

console.log('\nVerifying SMTP connection...');
transporter.verify(function(err, success) {
  if (err) {
    console.error('SMTP FAILED:', err.message);
    console.error('Code:', err.code);
    if (err.code === 'EAUTH') {
      console.log('\nFix: Make sure you generated a Gmail APP PASSWORD (not your regular password)');
      console.log('Go to: https://myaccount.google.com/apppasswords');
    }
    process.exit(1);
  }

  console.log('SMTP OK - Connected to Gmail!');
  console.log('\nSending test email to:', EMAIL_USER);

  transporter.sendMail({
    from: '"TicketFlow" <' + EMAIL_USER + '>',
    to: EMAIL_USER,
    subject: 'TicketFlow - Email Test',
    html: '<h2>Email is working!</h2><p>Your TicketFlow booking emails are configured correctly.</p>',
  }, function(err2, info) {
    if (err2) {
      console.error('SEND FAILED:', err2.message);
    } else {
      console.log('SUCCESS! Email sent. MessageId:', info.messageId);
      console.log('Check your inbox at:', EMAIL_USER);
    }
  });
});
