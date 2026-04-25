const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { db } = require('./services/supabase');

const issuesRoutes = require('./routes/issues');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const citizenRoutes = require('./routes/citizen');
const { seedOnStartup } = require('./seed');
const { startDeadlineChecker } = require('./services/deadlineChecker');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    var allowed = [
      process.env.CLIENT_URL,
      'https://civpulse.in',
      'https://www.civpulse.in',
      'http://localhost:5173'
    ].filter(Boolean);
    if (!origin || allowed.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/issues', issuesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/citizen', citizenRoutes);

// Public analytics (no auth required)
app.get('/api/analytics', async (req, res) => {
  try {
    const analytics = await db.getAnalytics(null);
    res.json({ success: true, ...analytics });
  } catch (error) {
    console.error('Error fetching public analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 CivicPulse server running on port ${PORT}`);
  await seedOnStartup();
  startDeadlineChecker();
});

module.exports = app;
