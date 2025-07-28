const mongoose = require('mongoose');

const regionAnalyticsSchema = new mongoose.Schema({
  qrId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  regionCounts: {
    hurry: { type: Number, default: 0 },
    mindfully: { type: Number, default: 0 },
    distracted: { type: Number, default: 0 }
  },
  totalSelections: { type: Number, default: 0 },
}, {
  timestamps: true
});



module.exports = mongoose.model('RegionAnalytics', regionAnalyticsSchema);
