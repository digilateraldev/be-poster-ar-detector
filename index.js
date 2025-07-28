const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cookieParser = require('cookie-parser');
const { deviceIdMiddleware } = require('./middleware/deviceId');

dotenv.config();
connectDB();

const app = express();

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Middleware
app.use(express.json());
app.use(cookieParser()); 
app.use(deviceIdMiddleware); 

// Routes
app.use('/qr', require('./routes/qrRoutes'));
app.use('/selection', require('./routes/selectionRoutes'));
app.use('/analytics', require('./routes/regionAnalyticsRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
