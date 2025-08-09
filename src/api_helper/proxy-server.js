const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Proxy cho AI Server
app.use('/api/ai', createProxyMiddleware({
    target: 'http://192.168.1.32:8000',
    changeOrigin: true,
    pathRewrite: {
        '^/api/ai': '', // Removes /api/ai from the path
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy connection failed' });
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`Proxying ${req.method} ${req.url} to ${proxyReq.path}`);
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Proxy server running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
    console.log(`📡 Proxying AI requests to http://192.168.1.32:8000`);
});