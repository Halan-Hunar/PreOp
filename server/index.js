require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '500kb' }));
app.use(cookieParser());

// Rate limit only the login endpoint (POST /api/auth/login).
// `skipSuccessfulRequests` means good logins don't burn the budget — only
// repeated failures count, which is what brute-force protection actually wants.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again later.' },
});

// General API limiter — catch-all to prevent hammering authenticated endpoints.
// Login has its own stricter limiter above; skip here to avoid double-counting.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req) => req.path === '/auth/login',
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', generalLimiter);

// Routes — limiter wired to /login only so /me and /logout aren't throttled.
const authRouter = require('./routes/auth');
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/patients', require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/attendance', require('./routes/attendance'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler (no stack traces to client)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
