const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brandNo: { type: String, trim: true, default: null },
  logo: { type: String, default: null }, // file path
  isManualPayment: { type: Boolean, default: false }, // USPTO Office special flag
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);
