const mongoose = require('mongoose');

// This collection tracks each hostel student's meal check-ins.
// One document per student per day per meal type.
// When a student scans the QR, we check if a document already exists
// for that student + today's date + meal type. If yes → already taken.
// If no → create it → meal marked as taken.

const mealCheckInSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional now
  messId:   { type: String, default: 'N/A' },
  userName: { type: String, required: true },
  meal:     { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  date:     { type: String, required: true }, // stored as "YYYY-MM-DD"
  scannedAt:{ type: Date, default: Date.now },
  orderStatus: { type: String, enum: ['scanned', 'ordered', 'completed'], default: 'scanned' }, // track if they actually ordered
});

// Compound unique index: one meal per student per day
mealCheckInSchema.index({ userName: 1, meal: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MealCheckIn', mealCheckInSchema);
