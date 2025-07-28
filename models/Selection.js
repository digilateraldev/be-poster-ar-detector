const mongoose = require('mongoose');

const selectionSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  qrId: {
    type: String,
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  selection: {
    type: String,
    required: true,
  },
  // selectionType: {
  //   type: String,
  //   default: 'pointer' // pointer, click, etc.
  // },
  coordinates: {
    x: Number,
    y: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  timestampIST: {
    type: String, 
    required: false
  },
  sessionData: {
    userAgent: String,
    screenResolution: String,
    pointerDuration: Number 
  }
}, {
  timestamps: true 
});

// Compound index for efficient queries
selectionSchema.index({ deviceId: 1, qrId: 1 });



module.exports = mongoose.model('Selection', selectionSchema);
