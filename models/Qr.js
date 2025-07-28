const mongoose = require('mongoose');

const qrSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true },
  // clinicId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Clinic' },
  qrName: { type: String, required: true },

  initialUrl: { type: String, required: true },
  finalUrl: { type: String, required: true },
  // imageUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  
  scanCount: { type: Number, default: 0 },
  scanHistory: [{
    scannedAt: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    deviceId: String 
  }]
},{
  timestamps:true
});



module.exports = mongoose.model('Qr', qrSchema);
