# Kinetix — Athletic Operations & 3D Studio Command Center

Kinetix is a full-stack gym and fitness club operations platform built for club directors, front-desk staff, sales advisors, and trainers. It combines live 3D facility monitoring, member lifecycle management, prospect pipelines, plans and billing, class scheduling, 2D/3D analytics, automated reminders, and a plain-English text and voice AI concierge.

Each gym or company can run Kinetix **100% locally and offline** as a standalone Windows desktop app (`.exe`) with encrypted local storage, while automatically checking **GitHub Releases** for software updates whenever an internet connection is available.

---

## Key Features

- **Role-Based Operations Dashboard**: Real-time club metrics, alerts, recent check-ins, and quick actions tailored to **Director**, **Front Desk**, **Sales**, and **Coach** views.
- **Interactive 3D Floor & Access Monitor**: Three.js 3D facility map displaying live zone occupancy, active coaches, equipment status cycling (`Operational`, `In Use`, `Maintenance`), and searchable check-in logs.
- **Member Profiles & Assessments**: Complete member records with contact details, fitness goals, notes, waivers/documents, emergency contacts, activity history, and workout/fitness checkup tracking.
- **Leads & Conversion Pipeline**: Prospect tracking by acquisition source, trial status, follow-up dates, stage progression, and one-click conversion into active members.
- **Membership Plans & Billing**: Subscription management (renewals, freezes, cancellations, payment retries) and transaction history.
- **Classes, Bookings & Staff Scheduling**: Session scheduling with capacity limits, enrollments, automated waitlists, trainer records, and retention indicators.
- **Report Center (2D & 3D Analytics)**: Interactive 2D and Three.js 3D charts with filters, date comparisons, and exportable summaries across membership, revenue, attendance, retention, and sales.
- **Automated Gym Communications**: Triggered in-app and email reminder rules for expiring memberships, upcoming bookings, waitlist openings, overdue follow-ups, and operational alerts.
- **AI Club Concierge (Text & Voice)**: Plain-English operations assistant supporting both Groq and Google Gemini engines, selectable assistant styles, microphone voice transcription, and spoken audio replies.
- **Multi-Profile Gmail Support**: Maintain multiple isolated user profiles on the same desktop or browser using Gmail / Google sign-in, keeping every profile's club records strictly separate.
- **Encrypted Offline Company Storage**: Standalone desktop runs save every profile's data locally on the computer using AES-256-GCM encryption protected by Windows DPAPI (`safeStorage`), with optional per-profile passcode locks.
- **Automatic GitHub Updates**: Packaged Windows builds check GitHub Releases automatically when online and update smoothly without touching local profile data.

---

## Security Architecture

- **Encrypted Per-Profile Vaults**: Each offline profile workspace is isolated into its own AES-256-GCM encrypted vault on disk with per-save random IVs, OS-protected secrets, and optional scrypt-hashed profile passcodes.
- **Isolated Desktop Runtime**: Electron runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, blocked untrusted navigation, and a per-launch constant-time local session token bound strictly to `127.0.0.1`.
- **Server & Export Hardening**: HTTP security headers, sliding-window rate limiting, input sanitization, and spreadsheet formula-injection neutralization across all CSV exports.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Three.js, Lucide Icons, Motion
- **Backend**: Node.js, Express, `tsx`
- **Desktop & Updates**: Electron, `electron-builder` (Windows NSIS `.exe`), `electron-updater` (GitHub Releases)
- **Storage**: Encrypted Local Vault (Offline Desktop) / PostgreSQL with Drizzle ORM (Cloud)
- **AI & Voice**: Server-side AI orchestration (Groq & Google Gemini) with voice transcription and speech playback

---

## One-Click Windows `.exe` Installer

Kinetix packages into a **one-click Windows NSIS installer** (`Kinetix-Setup-<version>.exe`): double-clicking the `.exe` installs Kinetix immediately without multi-step setup wizards, creates Desktop and Start Menu shortcuts, launches the app automatically, and keeps all encrypted local company data across updates.

### Option A — Automated Build & Publish via GitHub Releases
1. Push this repository to **GitHub** (`main` or `master` branch, or a `v*` tag).
2. The **Build & Publish Windows One-Click Installer** GitHub Action runs automatically on Windows and publishes `Kinetix-Setup-1.0.0.exe` directly to the repository's **Releases** section.
3. Anyone can open the repository's **Releases** section on GitHub (or use the **Windows Desktop App** section inside Kinetix Settings once connected) and click `Kinetix-Setup-1.0.0.exe` to download and install in one click.

### Option B — Build Directly on a Windows PC
1. Download or clone the repository onto a Windows computer with Node.js 20+ installed.
2. Double-click `build-windows-exe.bat` (or run `npm run dist:win`).
3. Your one-click installer `Kinetix-Setup-<version>.exe` will be generated inside the `release\` folder.

---

## Local Development

```bash
npm install
npm run dev
```

Type-check and build production assets:

```bash
npm run lint
npm run build
npm start
```
