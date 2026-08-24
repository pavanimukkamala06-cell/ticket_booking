const QRCode = require('qrcode');

/**
 * Generate a QR code as a data URL (base64 PNG)
 * @param {string} text - Content to encode (booking ref)
 * @returns {Promise<string>} - data:image/png;base64,...
 */
async function generateQRCode(text) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });
}

module.exports = { generateQRCode };
