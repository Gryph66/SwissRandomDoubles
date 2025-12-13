import rateLimit from 'express-rate-limit';

// Rate limiter for archive endpoint - 5 requests per day per IP
export const archiveRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: {
    success: false,
    message: 'Too many tournaments archived from this IP. Please try again tomorrow.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for view endpoint - 100 requests per hour per IP
export const viewRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
