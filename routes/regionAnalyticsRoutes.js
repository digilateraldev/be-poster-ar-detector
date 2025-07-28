const express = require('express');
const {
  updateRegionCountAPI,
  getRegionAnalytics,
  getAllRegionAnalytics,
} = require('../controllers/regionAnalyticsController');

const router = express.Router();

router.post('/update', updateRegionCountAPI);
router.get('/:qrId', getRegionAnalytics);
router.get('/', getAllRegionAnalytics);

module.exports = router;
