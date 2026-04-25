const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { db } = require('../services/supabase');
const { loginLimiter, otpLimiter, verifyOtpLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required.');
  process.exit(1);
}
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// In-memory OTP store: { email: { code, expiresAt, attempts, type, name, phone, password_hash } }
const otpStore = new Map();
const MAX_OTP_ATTEMPTS = 3;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateCitizenToken(citizen) {
  return jwt.sign(
    { id: citizen.id, email: citizen.email, name: citizen.name, type: 'citizen' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include a number.';
  return null;
}

async function sendOTPEmail(email, code) {
  if (resend) {
    try {
      await resend.emails.send({
        from: 'CivicPulse <noreply@civpulse.in>',
        to: email,
        subject: `${code} is your CivicPulse verification code`,
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #4f46e5;">CivicPulse</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e293b; background: #f1f5f9; padding: 16px 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 14px;">This code expires in 5 minutes. Don't share it with anyone.</p>
          </div>
        `
      });
      console.log(`[OTP] Sent to ${email}`);
    } catch (err) {
      console.error('[OTP] Email failed:', err.message);
    }
  } else {
    console.log(`[OTP] No Resend key — code for ${email}: ${code}`);
  }
}

/**
 * POST /api/citizen/register — Step 1: Validate + send OTP
 */
router.post('/register', otpLimiter, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = await db.getCitizenByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const code = generateOTP();

    otpStore.set(email.toLowerCase(), {
      code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0,
      type: 'register', name, phone: phone || null, password_hash
    });

    await sendOTPEmail(email, code);

    res.json({ success: true, requires_otp: true, message: 'Verify your email to complete registration.' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

/**
 * POST /api/citizen/login — Step 1: Validate password + send OTP
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const citizen = await db.getCitizenByEmail(email);
    if (!citizen) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, citizen.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const code = generateOTP();

    otpStore.set(email.toLowerCase(), {
      code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0,
      type: 'login', citizenId: citizen.id
    });

    await sendOTPEmail(email, code);

    res.json({ success: true, requires_otp: true, message: 'Enter the OTP sent to your email.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * POST /api/citizen/verify-otp — Step 2: Verify OTP and complete login/register
 */
router.post('/verify-otp', verifyOtpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const stored = otpStore.get(email.toLowerCase());
    if (!stored) {
      return res.status(400).json({ error: 'No OTP found. Please start over.' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP expired. Please try again.' });
    }
    if (stored.code !== otp) {
      stored.attempts++;
      if (stored.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(email.toLowerCase());
        return res.status(400).json({ error: 'Too many wrong attempts. OTP invalidated. Please start over.' });
      }
      return res.status(400).json({ error: `Invalid OTP. ${MAX_OTP_ATTEMPTS - stored.attempts} attempt(s) remaining.` });
    }

    otpStore.delete(email.toLowerCase());

    let citizen;

    if (stored.type === 'register') {
      // Create the account now
      citizen = await db.createCitizen({
        name: stored.name, email, phone: stored.phone, password_hash: stored.password_hash
      });
    } else {
      // Login — fetch citizen
      citizen = await db.getCitizenByEmail(email);
      if (!citizen) {
        return res.status(400).json({ error: 'Account not found.' });
      }
    }

    const token = generateCitizenToken(citizen);

    res.json({
      success: true,
      token,
      citizen: { id: citizen.id, name: citizen.name, email: citizen.email, phone: citizen.phone }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

/**
 * POST /api/citizen/resend-otp — Resend the OTP
 */
router.post('/resend-otp', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const stored = otpStore.get(email?.toLowerCase());
    if (!stored) {
      return res.status(400).json({ error: 'No pending verification. Please start over.' });
    }

    const code = generateOTP();
    stored.code = code;
    stored.expiresAt = Date.now() + 5 * 60 * 1000;
    stored.attempts = 0;

    await sendOTPEmail(email, code);

    res.json({ success: true, message: 'New OTP sent.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

/**
 * GET /api/citizen/my-issues — Get all issues by logged-in citizen
 */
router.get('/my-issues', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Login required.' });
    }
    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    const issues = await db.getIssuesByCitizen(decoded.id);
    res.json({ success: true, issues });
  } catch (error) {
    console.error('Error fetching citizen issues:', error);
    res.status(500).json({ error: 'Failed to fetch your issues.' });
  }
});

module.exports = router;

