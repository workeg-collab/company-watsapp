const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');

const webhookRoutes = require('./routes/webhookRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  if (!req.path.startsWith('/css') && !req.path.startsWith('/js') && !req.path.startsWith('/favicon')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Serve Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

// Dedicated Client Portal Route
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

// Webhook Routes (Supports both /api/webhook and /webhook)
app.use('/api/webhook', webhookRoutes);
app.use('/webhook', webhookRoutes);

// Dashboard REST API Routes
app.use('/api', apiRoutes);

// Fallback to Dashboard SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server if executed directly
if (require.main === module) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log('  🚀 Power of Media - Multi-Tenant WhatsApp SaaS   ');
    console.log('====================================================');
    console.log(`  🌐 Admin Dashboard:  http://localhost:${PORT}`);
    console.log(`  👤 Client Portal:    http://localhost:${PORT}/portal`);
    console.log(`  🔗 Webhook Endpoint: http://localhost:${PORT}/api/webhook`);
    console.log('====================================================\n');
  });
}

module.exports = app;
