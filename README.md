# CivicPulse 🏙️

**AI-Powered Civic Issue Reporting Platform for Indian Cities**

> AI-Powered Smart City Public Works Feedback System

CivicPulse enables citizens to report civic issues (potholes, broken streetlights, garbage dumps, water leaks) in **under 30 seconds** with photo + GPS evidence. AI classifies the issue automatically. Municipal authorities manage everything through a real-time map dashboard.

---

## 🎯 Features

### For Citizens
- 📸 **Photo Evidence** — Take/upload a photo of the issue
- 📍 **Automatic GPS** — Location captured automatically
- 🤖 **AI Classification** — YOLOv11 identifies issue type instantly
- 🎫 **Ticket Tracking** — Unique ticket ID to track complaint status
- 👤 **User Profile** — Register to see all your submitted reports in one place
- 📊 **Public Analytics** — City-level civic health data for transparency

### For Municipal Admins
- 🗺️ **Real-Time Map** — Leaflet.js map with color-coded issue markers
- 🔍 **Filter & Search** — Filter by status, category, city
- 🏷️ **Status Management** — Update issues (Pending → Assigned → In Progress → Resolved)
- 📈 **Analytics Dashboard** — Category breakdown, resolution times, civic health scores
- 🔐 **City-Scoped Access** — Admins only see issues from their assigned city

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│ AI Service   │
│  React+Vite  │     │  Express.js  │     │   FastAPI     │
│  Port 5173   │     │  Port 5000   │     │  Port 8000    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │   Supabase    │
                    │  (PostgreSQL) │
                    └───────────────┘
```

| Service | Tech Stack | Purpose |
|---------|-----------|---------|
| `client/` | React, Vite, Tailwind CSS, Leaflet.js, Recharts | Citizen & Admin UI |
| `server/` | Node.js, Express, JWT, Supabase | REST API, Auth, Business Logic |
| `ai-service/` | Python, FastAPI, Roboflow | Image Classification |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+ (optional, for AI service)

### 1. Backend Server
```bash
cd server
npm install
node src/app.js
```
The server auto-seeds admin accounts on startup.

### 2. Frontend
```bash
cd client
npm install
npx vite
```

### 3. AI Service (optional)
```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

Open **http://localhost:5173** for the citizen portal.  
Open **http://localhost:5173/admin/login** for the admin dashboard.

---

## 🔑 Admin Credentials

| Email | Role | City |
|-------|------|------|
| `shivakarthik5621@gmail.com` | Super Admin | All India |
| `shivakarthik5622@gmail.com` | City Admin | Hyderabad |

### Citizen Accounts
Register at `/login` with email + password. OTP verification required (2FA).

---



---

## 🔧 Environment Variables

### Server (`server/.env`)
```env
SUPABASE_URL=          # Leave empty for demo mode
SUPABASE_KEY=
CLOUDINARY_CLOUD_NAME= # Leave empty for base64 fallback
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
JWT_SECRET=civicpulse-super-secret-key-2026
AI_SERVICE_URL=http://localhost:8000
PORT=5000
CLIENT_URL=http://localhost:5173
```

### AI Service (`ai-service/.env`)
```env
ROBOFLOW_API_KEY=      # Leave empty for mock classification
ROBOFLOW_MODEL_ENDPOINT=
PORT=8000
```

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000
```

---

## 📂 Project Structure

```
CivicPulse/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── common/        # Navbar, AdminNavbar
│   │   ├── context/           # AuthContext, CitizenAuthContext
│   │   ├── pages/             # Home, Report, Track, Analytics, Login, Profile
│   │   │                      # AdminLogin, AdminDashboard
│   │   ├── services/          # API client (axios)
│   │   ├── App.jsx            # Routes + Layout
│   │   └── index.css          # Design System
│   └── index.html
│
├── server/                    # Express Backend
│   ├── src/
│   │   ├── routes/            # issues, admin, auth, citizen
│   │   ├── services/          # supabase, cloudinary, classifier
│   │   ├── middleware/        # auth (JWT), rateLimit
│   │   ├── utils/             # ticketId generator
│   │   ├── seed.js            # Demo data seeder
│   │   └── app.js             # Entry point
│   └── .env
│
└── ai-service/                # FastAPI AI Service
    ├── main.py                # /classify endpoint
    └── requirements.txt
```

---

## 🛡️ Security

- **JWT Authentication** — Separate tokens for citizens and admins
- **City-Scoped Access** — Admins restricted to their assigned city
- **Rate Limiting** — 5 submissions/hour, 5 login attempts/15 min
- **Input Validation** — Image type/size validation, coordinate checks
- **CORS** — Locked to frontend origin

---

## 📜 API Endpoints

### Citizen
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/issues` | Submit issue (multipart) |
| `GET` | `/api/issues/:ticketId` | Track issue by ticket ID |
| `POST` | `/api/citizen/register` | Register citizen account |
| `POST` | `/api/citizen/login` | Citizen login |
| `GET` | `/api/citizen/my-issues` | Get citizen's own issues |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Admin login |
| `GET` | `/api/admin/issues` | List issues (filtered, city-scoped) |
| `PATCH` | `/api/admin/issues/:id` | Update issue status |
| `POST` | `/api/admin/issues/:id/invalid` | Mark issue invalid |
| `GET` | `/api/admin/analytics` | Analytics data |

---

## 👥 Team

Built with ❤️ for Indian cities
