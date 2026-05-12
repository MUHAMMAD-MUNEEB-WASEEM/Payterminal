const { v4: uuidv4 } = require('uuid');

function generateInvoiceNumber() {
  // Format: INV-XXXXXXXX (8 uppercase alphanumeric chars)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'INV-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = { generateInvoiceNumber };
