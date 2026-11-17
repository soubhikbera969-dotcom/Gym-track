# Kinetix — Athletic Operations & 3D Studio Command Center

Kinetix is a full-stack gym and fitness club operations CRM built for club directors, front-desk staff, sales advisors, and trainers. It brings together live 3D facility monitoring, member lifecycle management, prospect pipelines, plans and billing, class scheduling, 2D/3D analytics, automated communications, and a voice-enabled AI operations concierge in a single workspace.

---

## Key Features

- **Role-Based Operations Dashboard**: Real-time club metrics, alerts, recent check-ins, and quick actions tailored to **Director**, **Front Desk**, **Sales**, and **Coach** views.
- **Interactive 3D Floor & Access Monitor**: Three.js 3D facility map displaying live zone occupancy, active coaches, equipment status cycling (`Operational`, `In Use`, `Maintenance`), and searchable check-in logs.
- **Member Profiles & Assessments**: Member records with contact details, fitness goals, notes, waivers/documents, emergency contacts, activity history, and workout/fitness checkup tracking.
- **Leads & Conversion Pipeline**: Prospect tracking by acquisition source, trial status, follow-up dates, stage progression, and one-click conversion into active members.
- **Membership Plans & Billing**: Subscription management (renewals, freezes, cancellations, payment retries) and transaction history.
- **Classes, Bookings & Staff Scheduling**: Session scheduling with capacity limits, enrollments, automated waitlists, trainer records, and retention indicators.
- **Report Center (2D & 3D Analytics)**: Interactive 2D and Three.js 3D charts with filters, date comparisons, and exportable summaries across membership, revenue, attendance, retention, and sales.
- **Automated Gym Communications**: Triggered in-app and email reminder rules for expiring memberships, upcoming bookings, waitlist openings, overdue follow-ups, and operational alerts.
- **AI Club Concierge (Text & Voice)**: Tool-calling assistant with plain-English responses, selectable assistant styles, microphone voice transcription, and spoken audio replies.
- **Settings, Audit Trail & CSV Import/Export**: Club configuration, role-aware audit history, and CSV member import/export.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Three.js, Lucide Icons, Motion
- **Backend**: Node.js, Express, `tsx`
- **Database**: PostgreSQL (Cloud SQL) with Drizzle ORM (`src/db/schema.ts`)
- **Authentication**: Firebase Auth (Google Sign-In) & Firebase Admin SDK
- **AI & Voice**: Server-side AI orchestration (`@google/genai` & Groq) with voice transcription and speech playback

---

## Project Structure

```text
├── server.ts                  # Express server, API routes, and Vite dev middleware
├── firebase-applet-config.json # Firebase client configuration
├── src/
│   ├── App.tsx                # Main application shell and workspace state
│   ├── components/            # CRM screens, 3D floor, 2D/3D charts, drawers, modals
│   ├── contexts/              # AuthContext (Firebase Auth + authenticated fetch)
│   ├── db/                    # Drizzle schema, PostgreSQL pool, seed, and repository
│   ├── server/                # AI concierge engine (Groq + Gemini tool calling & voice)
│   └── types/                 # Shared TypeScript domain interfaces
└── package.json
```

---

## Local Development

Install dependencies and start the development server on port `3000`:

```bash
npm install
npm run dev
```

Type-check and build for production:

```bash
npm run lint
npm run build
npm start
```
