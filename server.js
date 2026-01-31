// server.js - Fox Eye Security Tracker Server
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store guard locations in memory
let guardLocations = {};

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Fox Eye Tracker API is running',
        timestamp: new Date().toISOString()
    });
});

// Guard sends location update
app.post('/api/location', (req, res) => {
    const { guardId, latitude, longitude, accuracy, battery } = req.body;
    
    guardLocations[guardId] = {
        ...req.body,
        timestamp: new Date().toISOString(),
        status: 'online'
    };
    
    console.log(`📍 ${guardId} at ${latitude},${longitude}`);
    res.json({ success: true });
});

// Guard sends SOS
app.post('/api/sos', (req, res) => {
    const { guardId, latitude, longitude } = req.body;
    
    guardLocations[guardId] = {
        ...guardLocations[guardId],
        ...req.body,
        sos: true,
        timestamp: new Date().toISOString()
    };
    
    console.log(`🚨 SOS from ${guardId} at ${latitude},${longitude}`);
    res.json({ success: true, alertSent: true });
});

// Admin gets all locations
app.get('/api/locations', (req, res) => {
    const fiveMinutesAgo = Date.now() - 300000;
    
    Object.keys(guardLocations).forEach(guardId => {
        const guard = guardLocations[guardId];
        const lastUpdate = new Date(guard.timestamp).getTime();
        
        if (lastUpdate < fiveMinutesAgo) {
            guardLocations[guardId].status = 'offline';
        }
    });
    
    res.json(Object.values(guardLocations));
});

// HTML Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/guard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'guard.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Fox Eye Tracker running on port ${PORT}`);
    console.log(`📡 Admin: http://localhost:${PORT}/admin`);
    console.log(`📱 Guard: http://localhost:${PORT}/guard`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
});
