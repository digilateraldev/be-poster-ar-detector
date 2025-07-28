const express = require('express');
const {
  storeSelection,
  getSelection,
} = require('../controllers/selectionController');

const router = express.Router();

router.post('/store', storeSelection);
router.get('/:deviceId/:qrId', getSelection);

module.exports = router;
