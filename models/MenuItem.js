const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  desc:       { type: String, default: '' },
  price:      { type: Number, required: true },
  category:   { type: String, enum: ['breakfast', 'lunch', 'snacks'], required: true },
  image:      { type: String, default: '' },
  available:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
