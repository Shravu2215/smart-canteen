const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:  { type: String },
  meal:      { type: String, enum: ['breakfast', 'lunch', 'dinner'] }, // which meal is this order for
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name:  String,
    price: Number,
    qty:   Number,
  }],
  total:         { type: Number, required: true },
  paymentMethod: { type: String, enum: ['upi', 'cash'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  orderStatus:   { type: String, enum: ['pending', 'ready', 'collected'], default: 'pending' },
  orderId:       { type: String, unique: true },
}, { timestamps: true });

// Auto-generate orderId before saving
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = '#' + Math.floor(1000 + Math.random() * 9000) + Date.now().toString().slice(-4);
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
