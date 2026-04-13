const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { getEmailConfig } = require('./services/email');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Compress all responses
app.use(compression());

// Hide server info
app.disable('x-powered-by');

// Rate limiting — 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Strict rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again later.' }
});
app.use('/api/auth/', authLimiter);

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://localhost:3000',
    'https://ledge-stay.up.railway.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/config', (req, res) => {
  res.json({
    mapsEmbedApiKey: process.env.GOOGLE_MAPS_EMBED_API_KEY || ''
  });
});

app.get('/api/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoConnected = mongoState === 1;

  return res.status(mongoConnected ? 200 : 503).json({
    status: mongoConnected ? 'ok' : 'degraded',
    uptimeSec: Math.round(process.uptime()),
    mongo: {
      connected: mongoConnected,
      state: mongoState
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/sitemap.xml', (req, res) => {
  const lastModifiedDate = new Date().toISOString().split('T')[0];
  const sitemapEntries = [
    {
      loc: 'https://ledgestay.in/',
      priority: '1.0',
      changefreq: 'daily'
    },
    {
      loc: 'https://ledgestay.in/listings',
      priority: '0.9',
      changefreq: 'daily'
    },
    {
      loc: 'https://ledgestay.in/search',
      priority: '0.8',
      changefreq: 'monthly'
    },
    {
      loc: 'https://ledgestay.in/about',
      priority: '0.7',
      changefreq: 'monthly'
    },
    {
      loc: 'https://ledgestay.in/contact',
      priority: '0.7',
      changefreq: 'monthly'
    }
  ];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${lastModifiedDate}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemapXml);
});

// Catch-all for ALL non-API routes (SPA entrypoint)
app.get(/^\/(?!api).*/, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[server] unhandled error', {
    path: req.path,
    method: req.method,
    message: err.message,
    stack: err.stack
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    message: err.message || 'Unexpected server error.'
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('DB Error:', err));

const emailConfig = getEmailConfig();
if (emailConfig.ready) {
  console.log('[email] Resend configuration loaded', {
    from: emailConfig.fromAddress,
    baseUrl: emailConfig.baseUrl
  });
} else {
  console.warn('[email] Resend configuration issues:', emailConfig.issues.join(' '));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

