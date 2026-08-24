const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'ticket-booking-secret-change-in-production';
const OFFER_SECRET = process.env.OFFER_SECRET || 'waitlist-offer-secret-change-in-production';

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, SECRET, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

function signOfferToken(payload, expiresIn = '15m') {
  return jwt.sign(payload, OFFER_SECRET, { expiresIn });
}

function verifyOfferToken(token) {
  return jwt.verify(token, OFFER_SECRET);
}

module.exports = { signToken, verifyToken, signOfferToken, verifyOfferToken };
