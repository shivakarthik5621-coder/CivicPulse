const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for citizen issue submissions.
 * 5 submissions per IP per hour.
 */
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many submissions. Please try again later. Maximum 5 reports per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

/**
 * Rate limiter for auth login attempts.
 * 10 attempts per 15 minutes.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for OTP sending (register, resend).
 * 3 OTP requests per 10 minutes per IP.
 */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: { error: 'Too many OTP requests. Please wait 10 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for OTP verification.
 * 5 verify attempts per 10 minutes per IP — prevents brute-force.
 */
const verifyOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { error: 'Too many verification attempts. Please request a new OTP.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { submitLimiter, loginLimiter, otpLimiter, verifyOtpLimiter };

