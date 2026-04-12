# LedgeStay

A rental listing platform helping users find, list, and manage accommodation stays with integrated enquiry management, admin approval workflow, and secure authentication.

## 🚀 Features

- **User Authentication**: Phone OTP (Twilio) + email/password with JWT tokens
- **Listing Management**: CRUD operations with Cloudinary image uploads, geolocation search, and admin approval workflow
- **Enquiry System**: Track rental inquiries with owner notifications
- **Wishlist**: Save favorite listings
- **Reviews & Ratings**: User feedback on listings
- **Admin Dashboard**: Moderate listings, manage approvals, view analytics
- **Search & Filters**: By location, price, gender preference, amenities
- **Notifications**: Real-time alerts for approvals, rejections, new enquiries

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB (Atlas) |
| **Auth** | JWT + Twilio OTP |
| **Images** | Cloudinary |
| **Email** | Resend |
| **Frontend** | Vanilla JavaScript SPA |
| **Security** | Helmet, express-rate-limit, compression |
| **Deployment** | Railway |

---

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account
- Twilio account (for OTP)
- Cloudinary account (for image uploads)
- Resend account (for email)

---

## 🔧 Local Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd ledge-stay
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root. Use `.env.example` as a template:

```bash
cp .env.example .env
```

Then fill in your actual credentials in `.env`:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
JWT_SECRET=your_32_plus_character_random_string
PORT=3000

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SID=your_verify_sid

RESEND_API_KEY=your_resend_key
EMAIL_FROM=LedgeStay <noreply@yourdomain.com>
APP_BASE_URL=http://localhost:3000

GOOGLE_MAPS_EMBED_API_KEY=optional_for_maps
```

**Important:** Never commit `.env` to git. It's already in `.gitignore`.

### 3. Run Locally

```bash
npm start
```

Server runs on `http://localhost:3000`. Health check: `http://localhost:3000/api/health`

---

## 🚢 Deployment (Railway)

1. **Push to GitHub** (`.env` is ignored)
2. **Connect Railway**: Link your GitHub repo
3. **Set Environment Variables** in Railway dashboard (copy all from `.env`)
4. **Deploy**: Railway auto-deploys on push to main

---

## 🔐 Security

### Built-in Protections

- **Environment Variables**: All secrets in `.env`, never committed
- **Rate Limiting**: 100 req/15min per IP (global), 10 req/15min per IP (auth)
- **Helmet**: Security headers enabled
- **Compression**: Gzip enabled
- **JWT Validation**: Required for protected routes
- **CORS**: Limited to whitelisted origins

### Critical Action Items

1. If `.env` was ever committed, **rotate all credentials immediately**
2. Check git history: `git log --all --full-diff -- .env`
3. Regenerate API keys in Twilio, Cloudinary, Resend, MongoDB

---

## 📁 Project Structure

```
ledge-stay/
├── models/              # MongoDB schemas
├── routes/              # API endpoints
├── middleware/          # Auth, uploads
├── services/            # Email, search
├── scripts/             # Migrations
└── public/              # Frontend SPA
```

---

## 📡 Key API Endpoints

- `POST /api/auth/send-otp` — Send SMS OTP
- `POST /api/auth/verify-otp` — Verify OTP & get JWT
- `GET /api/listings` — List approved listings
- `POST /api/listings` — Create listing (owner)
- `PATCH /api/admin/listings/:id/review` — Approve/reject (admin)
- `GET /api/health` — Health check

---

## 🔄 Database Migrations

```bash
npm run migrate:approval    # Add approvalStatus to existing listings
npm run rebuild:locations   # Rebuild geospatial index
```

---

## 📦 Key Dependencies

- `express` — Web framework
- `mongoose` — MongoDB ORM
- `jsonwebtoken` — Auth tokens
- `twilio` — SMS OTP
- `cloudinary` — Image hosting
- `helmet` — Security headers
- `express-rate-limit` — Rate limiting
- `compression` — Gzip

---

## 🧪 Testing

Currently, no test suite. To set up:

```bash
npm test  # (placeholder, currently no tests written)
```

Jest and Supertest are installed. Create test files in `tests/` folder.

---

## 🚨 Known Issues & TODOs

- [ ] Add input validation middleware (Joi/Zod)
- [ ] Rotate exposed credentials from git history
- [ ] Implement pagination for enquiries endpoint
- [ ] Add structured logging (Morgan/Pino)
- [ ] Fix XSS vulnerability in frontend (use `textContent` not `innerHTML`)
- [ ] Add test suite (Jest + Supertest)
- [ ] Implement refresh token strategy

---

## ✅ Environment Variables Checklist

- [ ] `MONGO_URI` set
- [ ] `JWT_SECRET` is 32+ characters
- [ ] All Twilio vars set
- [ ] All Cloudinary vars set
- [ ] Resend API key set
- [ ] `.env` in `.gitignore` ✓

---

Last updated: April 11, 2026
