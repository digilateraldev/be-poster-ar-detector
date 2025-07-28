const { nanoid } = require('nanoid');
const Selection = require('../models/Selection');
const RegionAnalytics = require('../models/RegionAnalytics');
const { updateRegionCount } = require('./regionAnalyticsController');

// Helper function to update or create selection for a device+qr combination
async function upsertSelection(selectionData) {
  const { deviceId, qrId } = selectionData;

  return await Selection.findOneAndUpdate(
    { deviceId, qrId },
    {
      ...selectionData,
      timestamp: new Date()
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );
}

async function storeSelection(req, res) {
  try {
    const {
      // deviceId,
      qrId,
      selection,
      coordinates,
      //   selectionType = 'pointer',
      //   pointerDuration,
      //   screenResolution
    } = req.body;

    // Validate required fields
    if (!qrId || !selection) {
      return res.status(400).json({
        success: false,
        error: 'qrId and selection are required'
      });
    }

    //  // Generate deviceId if not provided (for new users)
    //  let finalDeviceId = deviceId;
    //  if (!finalDeviceId) {
    //    finalDeviceId = nanoid(12);
    //  }

    // Use device ID from middleware (cookies)
    const finalDeviceId = req.deviceId;

    // Get client IP address
    const ipAddress = req.ip ||                         // Express IP
      req.headers['x-forwarded-for']?.split(',')[0] || // Best: original IP from proxy
      req.connection.remoteAddress ||                   // TCP connection
      req.socket.remoteAddress ||                       // Socket connection
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'unknown';

    // Calculate IST timestamp for database storage
    const currentTime = new Date();
    const istTimestamp = currentTime.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Prepare selection data
    const selectionData = {
      deviceId: finalDeviceId,
      qrId,
      ipAddress,
      selection,
      // selectionType,
      coordinates,
      timestampIST: istTimestamp, // Store IST timestamp in database
      // sessionData: {
      //   userAgent: req.headers['user-agent'],
      //   screenResolution,
      //   pointerDuration
      //   }
    };

    // Use upsert method to update existing or create new
    const savedSelection = await upsertSelection(selectionData);

    console.log(`Selection ${savedSelection.isNew ? 'created' : 'updated'} for device: ${finalDeviceId}, QR: ${qrId}`);

    // Automatically update region analytics if selection is a valid region
    let regionAnalyticsUpdated = false;
    const validRegions = ['hurry', 'mindfully', 'distracted'];

    // console.log(`DEBUG: Checking if selection '${selection}' is in validRegions:`, validRegions);
    // console.log(`DEBUG: validRegions.includes(selection):`, validRegions.includes(selection));

    if (validRegions.includes(selection)) {
      // console.log(`DEBUG: Attempting to update region analytics for ${qrId}, region: ${selection}`);
      try {
        await updateRegionCount(qrId, selection);
        regionAnalyticsUpdated = true;
        // console.log(`SUCCESS: Region analytics updated for ${qrId}, region: ${selection}`);
      } catch (analyticsError) {
        console.error('ERROR: Failed to update region analytics:', analyticsError);
        console.error('ERROR: Stack trace:', analyticsError.stack);
      }
    } else {
      console.log(`DEBUG: Selection '${selection}' not in valid regions, skipping analytics update`);
    }

    // Convert timestamp to IST for response
    const responseIstTimestamp = new Date(savedSelection.timestamp).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    res.status(200).json({
      success: true,
      deviceId: finalDeviceId,
      selectionId: savedSelection._id,
      message: savedSelection.isNew ? 'Selection stored successfully' : 'Selection updated successfully',
      data: {
        qrId,
        selection,
        timestamp: savedSelection.timestamp, // Original UTC timestamp
        timestampIST: responseIstTimestamp, // IST formatted timestamp
        timezone: 'Asia/Kolkata (IST)',
        regionAnalyticsUpdated
      }
    });

  } catch (error) {
    console.error('Error storing selection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store selection',
      details: error.message
    });
  }
}

async function getSelection(req, res) {
  try {
    const { deviceId, qrId } = req.params;

    if (!deviceId || !qrId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId and qrId are required'
      });
    }

    const selection = await Selection.findOne({ deviceId, qrId });

    if (!selection) {
      return res.status(404).json({
        success: false,
        error: 'No selection found for this device and QR'
      });
    }

    // Convert timestamp to IST
    const istTimestamp = new Date(selection.timestamp).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    res.status(200).json({
      success: true,
      data: {
        ...selection.toObject(),
        timestampIST: istTimestamp,
        timezone: 'Asia/Kolkata (IST)'
      }
    });

  } catch (error) {
    console.error('Error retrieving selection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve selection',
      details: error.message
    });
  }
}

// async function getQRSelections(req, res) {
//   try {
//     const { qrId } = req.params;
//     const { page = 1, limit = 50 } = req.query;

//     if (!qrId) {
//       return res.status(400).json({
//         success: false,
//         error: 'qrId is required'
//       });
//     }

//     const skip = (page - 1) * limit;

//     const selections = await Selection.find({ qrId })
//       .sort({ timestamp: -1 })
//       .skip(skip)
//       .limit(parseInt(limit));

//     const totalCount = await Selection.countDocuments({ qrId });

//     // Generate analytics
//     const analytics = {
//       totalSelections: totalCount,
//       uniqueDevices: await Selection.distinct('deviceId', { qrId }).then(devices => devices.length),
//       selectionTypes: await Selection.aggregate([
//         { $match: { qrId } },
//         { $group: { _id: '$selectionType', count: { $sum: 1 } } }
//       ]),
//       averagePointerDuration: await Selection.aggregate([
//         { $match: { qrId, 'sessionData.pointerDuration': { $exists: true } } },
//         { $group: { _id: null, avgDuration: { $avg: '$sessionData.pointerDuration' } } }
//       ])
//     };

//     res.status(200).json({
//       success: true,
//       data: {
//         selections,
//         analytics,
//         pagination: {
//           currentPage: parseInt(page),
//           totalPages: Math.ceil(totalCount / limit),
//           totalCount,
//           hasNext: skip + selections.length < totalCount
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Error retrieving QR selections:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to retrieve QR selections',
//       details: error.message
//     });
//   }
// }

// async function deleteSelection(req, res) {
//   try {
//     const { deviceId, qrId } = req.params;

//     if (!deviceId || !qrId) {
//       return res.status(400).json({
//         success: false,
//         error: 'deviceId and qrId are required'
//       });
//     }

//     const deletedSelection = await Selection.findOneAndDelete({ deviceId, qrId });

//     if (!deletedSelection) {
//       return res.status(404).json({
//         success: false,
//         error: 'No selection found to delete'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Selection deleted successfully'
//     });

//   } catch (error) {
//     console.error('Error deleting selection:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to delete selection',
//       details: error.message
//     });
//   }
// }

module.exports = {
  storeSelection,
  getSelection,
  //   getQRSelections,
  //   deleteSelection
};
