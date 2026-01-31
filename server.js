// server.js - Fox Eye Security Tracker Server
const express = require('express');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
    origin: '*', // Allow all origins in production (adjust as needed)
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (use Redis/MongoDB in production)
let guardLocations = {};

// ==================== API ENDPOINTS ====================

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Fox Eye Tracker API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Guard sends location update
app.post('/api/location', (req, res) => {
    try {
        const { guardId, latitude, longitude, accuracy, battery, guardName } = req.body;
        
        if (!guardId || !latitude || !longitude) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: guardId, latitude, longitude' 
            });
        }
        
        guardLocations[guardId] = {
            id: guardId,
            name: guardName || `Guard ${guardId}`,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: accuracy ? parseInt(accuracy) : null,
            battery: battery ? parseInt(battery) : null,
            status: 'online',
            sos: false,
            lastUpdate: new Date().toISOString(),
            speed: req.body.speed || 0,
            heading: req.body.heading || null,
            site: req.body.site || 'On Duty'
        };
        
        console.log(`📍 ${guardId} at ${latitude}, ${longitude} (Accuracy: ${accuracy}m)`);
        
        res.json({ 
            success: true, 
            message: 'Location updated',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Guard sends SOS
app.post('/api/sos', (req, res) => {
    try {
        const { guardId, latitude, longitude, guardName } = req.body;
        
        if (!guardId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing guardId' 
            });
        }
        
        const existingData = guardLocations[guardId] || {};
        
        guardLocations[guardId] = {
            ...existingData,
            id: guardId,
            name: guardName || existingData.name || `Guard ${guardId}`,
            latitude: latitude ? parseFloat(latitude) : existingData.latitude,
            longitude: longitude ? parseFloat(longitude) : existingData.longitude,
            sos: true,
            status: 'online',
            lastUpdate: new Date().toISOString(),
            sosTimestamp: new Date().toISOString()
        };
        
        console.log(`🚨 SOS from ${guardId} at ${latitude},${longitude}`);
        console.log(`🚨 EMERGENCY ALERT: Guard ${guardName || guardId} needs immediate assistance!`);
        
        // In production: Send SMS/Email/Push notifications here
        sendEmergencyAlert(guardLocations[guardId]);
        
        res.json({ 
            success: true, 
            alertSent: true,
            message: 'SOS alert received and notifications sent',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error processing SOS:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process SOS alert' 
        });
    }
});

// Admin gets all locations
app.get('/api/locations', (req, res) => {
    try {
        // Mark guards as offline if no update in 5 minutes
        const fiveMinutesAgo = Date.now() - 300000;
        
        Object.keys(guardLocations).forEach(guardId => {
            const guard = guardLocations[guardId];
            if (guard && guard.lastUpdate) {
                const lastUpdate = new Date(guard.lastUpdate).getTime();
                
                if (lastUpdate < fiveMinutesAgo) {
                    guardLocations[guardId].status = 'offline';
                }
                
                // Auto-clear SOS after 30 minutes
                if (guard.sos && guard.sosTimestamp) {
                    const sosTime = new Date(guard.sosTimestamp).getTime();
                    if (Date.now() - sosTime > 1800000) { // 30 minutes
                        guardLocations[guardId].sos = false;
                    }
                }
            }
        });
        
        const locations = Object.values(guardLocations);
        
        res.json({
            success: true,
            count: locations.length,
            locations: locations,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch locations' 
        });
    }
});

// Get single guard location
app.get('/api/location/:guardId', (req, res) => {
    try {
        const { guardId } = req.params;
        const guard = guardLocations[guardId];
        
        if (!guard) {
            return res.status(404).json({ 
                success: false, 
                error: 'Guard not found' 
            });
        }
        
        res.json({
            success: true,
            location: guard
        });
        
    } catch (error) {
        console.error('Error fetching guard location:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Clear old data (optional cleanup endpoint)
app.post('/api/cleanup', (req, res) => {
    try {
        const oneHourAgo = Date.now() - 3600000;
        let cleanedCount = 0;
        
        Object.keys(guardLocations).forEach(guardId => {
            const guard = guardLocations[guardId];
            if (guard && guard.lastUpdate) {
                const lastUpdate = new Date(guard.lastUpdate).getTime();
                if (lastUpdate < oneHourAgo) {
                    delete guardLocations[guardId];
                    cleanedCount++;
                }
            }
        });
        
        res.json({
            success: true,
            message: `Cleaned up ${cleanedCount} old records`,
            remaining: Object.keys(guardLocations).length
        });
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Cleanup failed' 
        });
    }
});

// ==================== HTML ROUTES ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/guard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'guard.html'));
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET  /health',
            'GET  /admin',
            'GET  /guard',
            'POST /api/location',
            'POST /api/sos',
            'GET  /api/locations',
            'GET  /api/location/:guardId',
            'POST /api/cleanup'
        ]
    });
});

// ==================== HELPER FUNCTIONS ====================

function sendEmergencyAlert(guardData) {
    console.log('🚨 EMERGENCY ALERT SYSTEM ACTIVATED');
    console.log('=====================================');
    console.log(`Guard: ${guardData.name} (${guardData.id})`);
    console.log(`Location: ${guardData.latitude}, ${guardData.longitude}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log('=====================================');
    
    // Integration points (uncomment and configure as needed):
    
    // 1. Twilio SMS (install: npm install twilio)
    // const twilio = require('twilio');
    // const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // client.messages.create({
    //     body: `🚨 SOS: ${guardData.name} needs help! Location: ${guardData.latitude}, ${guardData.longitude}`,
    //     to: '+1234567890',
    //     from: '+1234567890'
    // });
    
    // 2. SendGrid Email (install: npm install @sendgrid/mail)
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // const msg = {
    //     to: 'security@example.com',
    //     from: 'alerts@foxeye.com',
    //     subject: '🚨 SOS Emergency Alert',
    //     text: `Guard ${guardData.name} (${guardData.id}) triggered SOS at ${guardData.latitude}, ${guardData.longitude}`
    // };
    // sgMail.send(msg);
    
    // 3. Webhook to external services
    // fetch('https://hooks.slack.com/services/...', {
    //     method: 'POST',
    //     headers: {'Content-Type': 'application/json'},
    //     body: JSON.stringify({
    //         text: `🚨 *SOS ALERT*: ${guardData.name} needs immediate assistance!\nLocation: ${guardData.latitude}, ${guardData.longitude}`
    //     })
    // });
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log('🦊 Fox Eye Security Tracker Server');
    console.log('='.repeat(50));
    console.log(`✅ Server running on http://${HOST}:${PORT}`);
    console.log(`📡 Admin Dashboard: http://${HOST}:${PORT}/admin`);
    console.log(`📱 Guard App: http://${HOST}:${PORT}/guard`);
    console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
    console.log('='.repeat(50));
    console.log('Ready to track guards in real-time!');
});