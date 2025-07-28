const express = require('express');
const {
  generateQR,
  getQRImage,
  getQRDetails,
  recordQRScan,
  getQRAnalytics,
} = require('../controllers/qrController');

const router = express.Router();

router.post('/create', generateQR);
router.get('/qr-codes/:filename', getQRImage);
router.get('/qr-details/:qrId', getQRDetails);
router.get('/scan', recordQRScan);
// router.post('/scan/:qrId', recordQRScan);
router.get('/analytics/:qrId', getQRAnalytics);


module.exports = router;
