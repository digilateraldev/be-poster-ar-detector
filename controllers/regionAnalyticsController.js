const RegionAnalytics = require('../models/RegionAnalytics');
const Selection = require('../models/Selection');

// Helper function to validate region names
function validateRegionName(regionName) {
  const validRegions = ['hurry', 'mindfully', 'distracted'];
  if (!validRegions.includes(regionName)) {
    throw new Error(`Invalid region name: ${regionName}. Valid regions are: ${validRegions.join(', ')}`);
  }
  return true;
}

// Helper function to increment region count
async function incrementRegionCount(analytics, regionName) {
  if (!(regionName in analytics.regionCounts)) {
    throw new Error(`Invalid region name: ${regionName}`);
  }
  
  analytics.regionCounts[regionName] += 1;
  analytics.totalSelections += 1;
  analytics.lastUpdated = new Date();
  
  // console.log(`DEBUG: Before save - Region counts:`, analytics.regionCounts);
  // console.log(`DEBUG: Total selections:`, analytics.totalSelections);
  
  const result = await analytics.save();
  // console.log(`DEBUG: After save - Document saved successfully:`, result._id);
  return result;
}

// Helper function to calculate region percentages
function calculateRegionPercentages(regionCounts, totalSelections) {
  if (totalSelections === 0) {
    return {
      hurry: 0,
      mindfully: 0,
      distracted: 0
    };
  }
  
  return {
    hurry: Math.round((regionCounts.hurry / totalSelections) * 100),
    mindfully: Math.round((regionCounts.mindfully / totalSelections) * 100),
    distracted: Math.round((regionCounts.distracted / totalSelections) * 100)
  };
}

// Helper function to update or create region analytics
async function updateRegionCount(qrId, regionName) {
  // Validate region name
  validateRegionName(regionName);

  // Find existing analytics or create new one
  let analytics = await RegionAnalytics.findOne({ qrId });
  
  if (!analytics) {
    // Create new analytics record
    analytics = new RegionAnalytics({
      qrId,
      regionCounts: {
        hurry: 0,
        mindfully: 0,
        distracted: 0
      }
    });
  }
  
  // Increment the specific region
  await incrementRegionCount(analytics, regionName);
  
  return analytics;
}

// Update region count when a selection is made
async function updateRegionCountAPI(req, res) {
  try {
    const { qrId, regionName } = req.body;

    if (!qrId || !regionName) {
      return res.status(400).json({
        success: false,
        error: 'qrId and regionName are required'
      });
    }

    const analytics = await updateRegionCount(qrId, regionName);

    res.status(200).json({
      success: true,
      message: 'Region count updated successfully',
      data: {
        qrId: analytics.qrId,
        regionCounts: analytics.regionCounts,
        totalSelections: analytics.totalSelections,
        // percentages: calculateRegionPercentages(analytics.regionCounts, analytics.totalSelections)
      }
    });

  } catch (error) {
    console.error('Error updating region count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update region count',
      details: error.message
    });
  }
}

// Get region analytics for a specific QR
async function getRegionAnalytics(req, res) {
  try {
    const { qrId } = req.params;

    if (!qrId) {
      return res.status(400).json({
        success: false,
        error: 'qrId is required'
      });
    }

    // Find analytics for this QR
    let analytics = await RegionAnalytics.findOne({ qrId });

    // If no analytics exist, create empty analytics
    if (!analytics) {
      analytics = {
        qrId,
        regionCounts: {
          hurry: 0,
          mindfully: 0,
          distracted: 0
        },
        totalSelections: 0,
        lastUpdated: null
      };
    }

    // Calculate percentages
    // const percentages = calculateRegionPercentages(analytics.regionCounts, analytics.totalSelections);

    // // Get the most popular region
    // const regionEntries = Object.entries(analytics.regionCounts);
    // const mostPopular = regionEntries.reduce((max, current) => 
    //   current[1] > max[1] ? current : max
    // );

    res.status(200).json({
      success: true,
      data: {
        qrId,
        regionCounts: analytics.regionCounts,
        regionPercentages: percentages,
        totalSelections: analytics.totalSelections,
        // mostPopularRegion: {
        //   name: mostPopular[0],
        //   count: mostPopular[1],
        //   // percentage: percentages[mostPopular[0]]
        // },
        lastUpdated: analytics.lastUpdated,
        createdAt: analytics.createdAt,
        updatedAt: analytics.updatedAt
      }
    });

  } catch (error) {
    console.error('Error retrieving region analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve region analytics',
      details: error.message
    });
  }
}

// Get analytics for all QRs (summary view)
async function getAllRegionAnalytics(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const analytics = await RegionAnalytics.find({})
      .sort({ totalSelections: -1 }) // Sort by most selections first
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await RegionAnalytics.countDocuments({});

    // Calculate overall statistics
    const overallStats = await RegionAnalytics.aggregate([
      {
        $group: {
          _id: null,
          totalQRs: { $sum: 1 },
          totalSelections: { $sum: '$totalSelections' },
          avgSelectionsPerQR: { $avg: '$totalSelections' },
          totalHurry: { $sum: '$regionCounts.hurry' },
          totalMindfully: { $sum: '$regionCounts.mindfully' },
          totalDistracted: { $sum: '$regionCounts.distracted' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        analytics: analytics.map(item => ({
          qrId: item.qrId,
          regionCounts: item.regionCounts,
          totalSelections: item.totalSelections,
          lastUpdated: item.lastUpdated,
          // percentages: calculateRegionPercentages(item.regionCounts, item.totalSelections)
        })),
        overallStats: overallStats[0] || {
          totalQRs: 0,
          totalSelections: 0,
          avgSelectionsPerQR: 0,
          totalHurry: 0,
          totalMindfully: 0,
          totalDistracted: 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: skip + analytics.length < totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving all region analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      details: error.message
    });
  }
}

// // Sync analytics from existing selections (one-time migration/sync)
// async function syncAnalyticsFromSelections(req, res) {
//   try {
//     console.log('Starting analytics sync from existing selections...');

//     // Get all selections
//     const selections = await Selection.find({});
    
//     let processedCount = 0;
//     let errorCount = 0;

//     for (const selection of selections) {
//       try {
//         // Assuming selection.selection contains the region name
//         const regionName = selection.selection;
        
//         // Validate if it's a valid region name
//         if (['hurry', 'mindfully', 'distracted'].includes(regionName)) {
//           await updateRegionCount(selection.qrId, regionName);
//           processedCount++;
//         }
//       } catch (error) {
//         console.error(`Error processing selection ${selection._id}:`, error);
//         errorCount++;
//       }
//     }

//     console.log(`Analytics sync completed. Processed: ${processedCount}, Errors: ${errorCount}`);

//     res.status(200).json({
//       success: true,
//       message: 'Analytics sync completed',
//       data: {
//         totalSelections: selections.length,
//         processedCount,
//         errorCount
//       }
//     });

//   } catch (error) {
//     console.error('Error syncing analytics:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to sync analytics',
//       details: error.message
//     });
//   }
// }

module.exports = {
  updateRegionCount, // Helper function for other controllers
  updateRegionCountAPI, // API endpoint function
  getRegionAnalytics,
  getAllRegionAnalytics,
  // syncAnalyticsFromSelections
};
