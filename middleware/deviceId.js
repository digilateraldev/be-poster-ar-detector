const { nanoid } = require('nanoid');

const deviceIdMiddleware = (req, res, next) => {
  try {
    let deviceId = req.cookies?.deviceId;
    
    //check request body or headers
    if (!deviceId) {
      deviceId = req.body?.deviceId || req.headers['x-device-id'];
    }
    
    // If still no device ID, generate a new one
    if (!deviceId) {
      deviceId = nanoid(12); 
      console.log('Generated new device ID:', deviceId);
    }
    
    // Set the device ID in cookies (expires in 1 year)
    res.cookie('deviceId', deviceId, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
      httpOnly: false, // Allow JavaScript access from client
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      path: '/' // Available for all routes
    });
    
    // Attach device ID to request object for use in controllers
    req.deviceId = deviceId;
    
    // Also add to response locals for potential template use
    res.locals.deviceId = deviceId;
    
    console.log('Device ID middleware - ID:', deviceId);
    next();
    
  } catch (error) {
    console.error('Device ID middleware error:', error);
    // Continue without device ID if there's an error
    req.deviceId = null;
    next();
  }
};

/**
 * get or generate device ID from request
 * Can be used in controllers when middleware is not applied
 */
const getDeviceId = (req, res) => {
  let deviceId = req.cookies?.deviceId || req.body?.deviceId || req.headers['x-device-id'];
  
  if (!deviceId) {
    deviceId = nanoid(12);
    if (res) {
      res.cookie('deviceId', deviceId, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
    }
  }
  
  return deviceId;
};

/**
 * Express middleware to ensure device ID is present
 * Returns error if device ID cannot be set
 */
const requireDeviceId = (req, res, next) => {
  if (!req.deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Device ID is required',
      message: 'Please ensure cookies are enabled or provide deviceId in request'
    });
  }
  next();
};

module.exports = {
  deviceIdMiddleware,
  getDeviceId,
  requireDeviceId
};
