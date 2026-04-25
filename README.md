# CivicPulse 🏙️

**AI-Powered Civic Issue Reporting Platform for Indian Cities**

> Empowering citizens to report civic issues in under 30 seconds — with photo evidence, GPS, and AI classification.

🌐 **Live at [civpulse.in](https://civpulse.in)**

---

## 🎯 Features

### For Citizens
- 📸 **Photo Evidence** — Take or upload a photo of the issue
- 📍 **Automatic GPS** — Location captured automatically, with manual city fallback
- 🤖 **AI Classification** — YOLOv11 via Roboflow identifies issue type instantly
- 🙋 **Manual Category Selection** — If AI can't classify, citizen picks the category themselves
- 🎫 **Ticket Tracking** — Unique ticket ID to track complaint status in real time
- ✅ **Dispute Resolution** — Citizens can dispute a resolved issue if the problem persists
- 👤 **User Profile** — Register to see all your submitted reports in one place
- 📊 **Public Analytics** — City-level civic health data for transparency

### For Municipal Admins
- 🗺️ **Real-Time Map** — Leaflet.js map with color-coded issue markers
- 🔍 **Filter & Search** — Filter by status, category, city
- 🏷️ **Status Management** — Update issues (Pending → Assigned → In Progress → Resolved)
- 📸 **Photo Proof on Resolve** — Admins must upload a resolution photo as evidence
- ⚠️ **Dispute Escalation** — Disputed resolutions are escalated to super admins + city admins via email
- 📈 **Analytics Dashboard** — Category breakdown, resolution times, civic health scores
- 🔐 **City-Scoped Access** — Admins only see issues from their assigned city

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    Frontend      │────▶│ Cloudflare Worker │────▶│  Railway (Node)  │
│ React + Vite     │     │  api.civpulse.in  │     │  Express API     │
│ Netlify          │     └──────────────────┘     └────────┬─────────┘
│ civpulse.in      │                                        │
└─────────────────┘                              ┌──────────┴──────────┐
                                                 │                     │
                                        ┌────────┴──────┐   ┌─────────┴──────┐
                                        │   Supabase    │   │ Railway (Python)│
                                        │  PostgreSQL   │   │  FastAPI + AI  │
                                        └───────────────┘   └────────────────┘
```

| Service | Tech | Hosting |
|---------|------|---------|
| `client/` | React, Vite, Leaflet.js, Recharts | Netlify |
| `server/` | Node.js, Express, JWT | Railway |
| `ai-service/` | Python, FastAPI, Roboflow YOLOv11 | Railway |
| Database | Supabase (PostgreSQL) | Supabase Cloud |
| Media | Cloudinary | Cloudinary |
| Email | Resend | Resend |
| API Proxy | Cloudflare Worker | Cloudflare (Free) |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- Python 3.9+

### 1. Backend Server
```bash
cd server
npm install
cp .env.example .env   # Fill in your credentials
node src/app.js
```

### 2. Frontend
```bash
cd client
npm install
cp .env.example .env   # Set VITE_API_URL=http://localhost:5000
npx vite
```

### 3. AI Service
```bash
cd ai-service
pip install -r requirements.txt
cp .env.example .env   # Add Roboflow credentials
python main.py
```

Open **http://localhost:5173** for the citizen portal.  
Open **http://localhost:5173/admin/login** for the admin dashboard.

---

## 🔑 Admin Credentials (Seeded on startup)

| Email | Role | City |
|-------|------|------|
| `shivakarthik5621@gmail.com` | Super Admin | All India |
| `shivakarthik5622@gmail.com` | City Admin | Hyderabad |

### Citizen Accounts
Register at `/login` with email + password. OTP email verification required (2FA via Resend).

---

## 🔧 Environment Variables

### Server (`server/.env`)
```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
JWT_SECRET=
AI_SERVICE_URL=http://localhost:8000
PORT=5000
CLIENT_URL=http://localhost:5173
RESEND_API_KEY=
NODE_ENV=development
```

### AI Service (`ai-service/.env`)
```env
ROBOFLOW_API_KEY=
ROBOFLOW_MODEL_ENDPOINT=
PORT=8000
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000
```

---

## 🔄 Issue Lifecycle

```
Submitted → Pending → Assigned → In Progress → Resolved
                                                    ↓
                                          Citizen confirms ✅
                                               or
                                          Citizen disputes ⚠️
                                                    ↓
                                    Re-opened + Escalated to admins
                                                    ↓
                                          Admin re-resolves 🔄
                                                    ↓
                                          Citizen reacts again
```

---

## 🤖 AI Classification Flow

1. Citizen uploads photo
2. Server sends image URL to Roboflow YOLOv11 model
3. **If classified** (confidence ≥ 25%) → category auto-assigned
4. **If not classified** → `requires_manual: true` returned → citizen selects category from 4 options:
   - 🕳️ Pothole
   - 💡 Broken Streetlight
   - 🗑️ Garbage Dump
   - 💧 Water Leakage

---

## 📂 Project Structure

```
CivicPulse/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/        # Navbar, AdminNavbar
│   │   ├── context/           # AuthContext, CitizenAuthContext
│   │   ├── pages/             # Home, Report, Track, Analytics,
│   │   │                      # Login, Profile, AdminLogin, AdminDashboard
│   │   ├── services/          # API client (axios)
│   │   ├── App.jsx
│   │   └── index.css          # Design system + CSS variables
│   └── index.html
│
├── server/                    # Express Backend
│   ├── src/
│   │   ├── routes/            # issues, admin, auth, citizen
│   │   ├── services/          # supabase, cloudinary, classifier, deadlineChecker
│   │   ├── middleware/        # auth (JWT), rateLimit
│   │   ├── utils/             # ticketId generator
│   │   ├── seed.js
│   │   └── app.js
│   └── schema.sql             # Supabase table definitions
│
└── ai-service/                # FastAPI AI Service
    ├── main.py                # /classify + /health endpoints
    └── requirements.txt
```

---

## 📜 API Reference

### Citizen Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/issues` | Submit issue (multipart/form-data) |
| `GET` | `/api/issues/:ticketId` | Track issue by ticket ID |
| `POST` | `/api/issues/:ticketId/react` | Confirm or dispute a resolution |
| `POST` | `/api/citizen/register` | Register citizen (triggers OTP) |
| `POST` | `/api/citizen/login` | Citizen login |
| `POST` | `/api/citizen/verify-otp` | Verify OTP |
| `GET` | `/api/citizen/my-issues` | Get citizen's own issues |

### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Admin login |
| `GET` | `/api/admin/issues` | List issues (filtered, city-scoped) |
| `PATCH` | `/api/admin/issues/:id` | Update issue status |
| `POST` | `/api/admin/issues/:id/resolve` | Resolve with photo proof |
| `POST` | `/api/admin/issues/:id/invalid` | Mark issue invalid |
| `GET` | `/api/admin/analytics` | Analytics data |

### AI Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check + mode (roboflow/manual) |
| `POST` | `/classify` | Classify image by URL |

---

## 🛡️ Security

- **JWT Authentication** — Separate tokens for citizens and admins
- **City-Scoped Access** — Admins restricted to their assigned city
- **Rate Limiting** — 5 submissions/hour, 5 login attempts/15 min
- **Input Validation** — Image type/size checks, coordinate validation
- **CORS** — Locked to frontend origin
- **Cloudflare Proxy** — API hidden behind Cloudflare Worker (carrier-safe for Indian mobile networks)

---

## 📦 Deployment

| Service | Platform | Domain |
|---------|----------|--------|
| Frontend | Netlify | civpulse.in |
| API | Railway | via Cloudflare Worker |
| AI Service | Railway | internal |
| DNS | Netlify DNS + Cloudflare Worker | — |

---

Built with ❤️ for Indian cities
