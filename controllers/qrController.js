const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const mongoose = require('mongoose');
const Qr = require('../models/Qr');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
// const SOLGLO_URL = process.env.SOLGLO_URL || 'https://digilateral.com/solglo-teaser';
const SOLGLO_URL = process.env.SOLGLO_URL || 'https://digilateral.com/eating-habit';


// Ensure QR codes directory exists
const qrCodesDir = path.join(__dirname, '../qr-codes');
if (!fs.existsSync(qrCodesDir)) {
  fs.mkdirSync(qrCodesDir, { recursive: true });
}

// Helper function to record QR scan
async function recordScanHelper(qr, scanData = {}) {
  qr.scanCount += 1;
  qr.lastScannedAt = new Date();

  // Add to scan history
  qr.scanHistory.push({
    scannedAt: new Date(),
    ipAddress: scanData.ipAddress || 'unknown',
    userAgent: scanData.userAgent || 'unknown',
    deviceId: scanData.deviceId || null
  });

  return await qr.save();
}

async function generateQR(req, res) {
  try {
    const { qrName } = req.body;

    if (!qrName) {
      return res.status(400).json({ error: "qrName is required" });
    }

    const qrId = nanoid(6);
    // const initialUrl = `${BASE_URL}/${qrId}`;
    // const initialUrl = `${BASE_URL}/qr/scan/${qrId}`;
    // const initialUrl = `${SOLGLO_URL}?qrId=${qrId}`; 
    // const finalUrl = `${SOLGLO_URL}?qrId=${qrId}`; // Final frontend URL where users land
    // QR code points to backend scan endpoint to track scans before redirecting
    const initialUrl = `${BASE_URL}/qr/scan?qrId=${qrId}`;
    const finalUrl = `${SOLGLO_URL}?qrId=${qrId}`; // Final frontend URL where users land after scan tracking
    // const imageUrl = `${BASE_URL}/qr-codes/${qrId}.svg`;

    console.log('Generating QR code for:', initialUrl);
    console.log('BASE_URL:', BASE_URL);
    console.log('SOLGLO_URL:', SOLGLO_URL);
    const qrSvg = await QRCode.toString(initialUrl, {
      type: 'svg',
      width: 300,
      margin: 2,
      color: {
        dark: '#2c3ceeff',
        light: '#ffffffff'
      }
    });

    // Save file BEFORE database record
    const filePath = path.resolve(qrCodesDir, `${qrId}.svg`);
    // console.log('Saving QR file to:', filePath);
    fs.writeFileSync(filePath, qrSvg);

    if (!fs.existsSync(filePath)) {
      throw new Error('QR file was not created successfully');
    }
    console.log('QR file created successfully');

    // Only save to database AFTER file generation succeeds
    const newQR = new Qr({
      qrId,
      qrName,
      initialUrl,
      finalUrl: finalUrl, // Store the final frontend URL
      // imageUrl,
      createdAt: new Date()
    });

    await newQR.save();
    console.log('QR record saved to database successfully');

    res.status(201).json({
      success: true,
      qrId,
      qrName,
      initialUrl,
      finalUrl, // Include final frontend URL in response
      // imageUrl
    });

  } catch (error) {
    console.error("QR Generation Error:", error);

    // Clean up any orphaned files if database save failed
    if (error.message && error.message.includes('QR file was not created successfully')) {
      console.log('File creation failed, no cleanup needed');
    } else {
      // If we got here, file might have been created but DB save failed
      try {
        const qrId = req.body.qrId || error.qrId;
        if (qrId) {
          const filePath = path.resolve(qrCodesDir, `${qrId}.svg`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Cleaned up orphaned QR file:', filePath);
          }
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: "QR generation failed",
      details: error.message
    });
  }
}

async function recordQRScan(req, res) {
  console.log('recordQRScan function');
  console.log('Query params:', req.query);
  console.log('URL:', req.url);
  
  try {
    const { qrId } = req.query; // Changed from req.params to req.query
    const deviceId = req.deviceId; // Device ID from middleware (cookies)
    // const deviceId = req.body?.deviceId || null;

    console.log('qrId:', qrId);
    console.log('Device ID:', deviceId);

    if (!qrId) {
      console.log('No qrId provided');
      return res.status(400).json({
        success: false,
        error: 'qrId is required'
      });
    }

    const qr = await Qr.findOne({ qrId });
    if (!qr) {
      return res.status(404).json({
        success: false,
        error: 'QR code not found'
      });
    }

    const ipAddress = req.ip ||                         // Express IP
      req.headers['x-forwarded-for']?.split(',')[0] || // Best: original IP from proxy
      req.connection.remoteAddress ||                   // TCP connection
      req.socket.remoteAddress ||                       // Socket connection
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'unknown';

    await recordScanHelper(qr, {
      ipAddress,
      userAgent: req.headers['user-agent'],
      deviceId
    });

    console.log(`QR scan recorded for ${qrId}. Total scans: ${qr.scanCount}`);

    // Redirect to frontend camera page with qrId (deviceId available via cookie)
    const frontendUrl = `${SOLGLO_URL}?qrId=${qrId}`;
    res.redirect(302, frontendUrl);

  } catch (error) {
    console.error('Error recording QR scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record scan',
      details: error.message
    });
  }
}

// Get QR scan analytics
async function getQRAnalytics(req, res) {
  try {
    const { qrId } = req.params;

    if (!qrId) {
      return res.status(400).json({
        success: false,
        error: 'qrId is required'
      });
    }

    const qr = await Qr.findOne({ qrId });
    if (!qr) {
      return res.status(404).json({
        success: false,
        error: 'QR code not found'
      });
    }

    const analytics = {
      qrId,
      totalScans: qr.scanCount,
      lastScannedAt: qr.lastScannedAt,
      createdAt: qr.createdAt,
      uniqueIPs: [...new Set(qr.scanHistory.map(scan => scan.ipAddress))].length,
      uniqueDevices: qr.scanHistory.filter(scan => scan.deviceId).length,
      scansByDay: {}, // Will be calculated below
      recentScans: qr.scanHistory.slice(-10).reverse() // Last 10 scans
    };

    // Group scans by day
    qr.scanHistory.forEach(scan => {
      const day = scan.scannedAt.toISOString().split('T')[0];
      analytics.scansByDay[day] = (analytics.scansByDay[day] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error retrieving QR analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      details: error.message
    });
  }
}


// // Generate QR code with styling and save to disk
// exports.generateQR = async (req, res) => {
//   try {
//     const { creator, type } = req.body;

//     // Generate unique QR ID
//     const qrId = nanoid(8);
//     const redirectUrl = `${BASE_URL}/qr/scan/${qrId}`;
//     const imageUrl = `${BASE_URL}/qr-codes/${qrId}.svg`;

//     // Create styled QR code
//     const qrCode = new QRCodeStyling({
//       jsdom: JSDOM,
//       nodeCanvas,
//       type: "svg",
//       width: 300,
//       height: 300,
//       data: redirectUrl,
//       dotsOptions: {
//         color: "#2c3ceeff",
//         type: "rounded",
//       },
//       backgroundOptions: {
//         color: "#ffffffff",
//       },
//       cornersSquareOptions: {
//         color: "#087b8dff",
//         type: "extra-rounded"
//       },
//       imageOptions: {
//         crossOrigin: "anonymous",
//         margin: 20,
//         saveAsBlob: true,
//       },
//     });

//     // Generate QR code buffer
//     const buffer = await qrCode.getRawData("svg");

//     // Save SVG to QRCode folder
//     const fileName = `${qrId}.svg`;
//     const filePath = path.join(qrCodesDir, fileName);
//     fs.writeFileSync(filePath, buffer);

//     // Create QR record in database
//     const newQR = new Qr({
//       qrId,
//       imageUrl,
//       redirectUrl,
//       createdAt: new Date(),
//       totalScans: 0,
//       scanEvents: [],
//       analytics: {
//         uniqueDetections: 0,
//         validDetections: 0,
//         categories: new Map()
//       }
//     });

//     await newQR.save();

//     res.status(200).json({
//       success: true,
//       qrId,
//       imageUrl,
//       redirectUrl,
//       filePath: `/QRCode/${fileName}`,
//       createdAt: new Date().toISOString(),
//       message: 'QR code generated successfully'
//     });

//   } catch (error) {
//     console.error('QR Generation Error:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'QR generation failed',
//       details: error.message 
//     });
//   }
// };

// Serve QR code images
function getQRImage(req, res) {
  try {
    let { filename } = req.params;

    // Ensure filename has .svg extension
    if (!filename.endsWith('.svg')) {
      filename = filename + '.svg';
    }

    const filePath = path.resolve(qrCodesDir, filename);

    // console.log('Requested file:', req.params.filename);
    // console.log('Processed file:', filename);
    // console.log('Full file path:', filePath);
    // console.log('QR codes directory:', qrCodesDir);
    // console.log('File exists:', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'QR code image not found' });
    }

    // Set appropriate content type for SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving QR image:', error);
    res.status(500).json({ error: 'Failed to serve QR image' });
  }
};

async function getQRDetails(req, res) {
  const { qrId } = req.params;

  try {
    const qr = await Qr.findOne({ qrId });

    if (!qr) {
      return res.status(404).json({ error: "QR not found" });
    }

    return res.status(200).json(qr);
  } catch (error) {
    console.error("Error in getQRDetails:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}


module.exports = {
  generateQR,
  getQRImage,
  getQRDetails,
  recordQRScan,
  getQRAnalytics
};

