# HRMS - HR Management & Candidate Onboarding System

A full-stack Human Resource Management System (HRMS) built with **React** (Tailwind CSS, Lucide Icons, Webpack) and **FastAPI** (Python, SQLAlchemy, PostgreSQL, JWT Authentication).

---

## 📁 Project Structure

```text
├── public/                 # Frontend HTML template
├── src/                    # React Frontend source code
│   ├── assets/             # Images and SVG icons
│   ├── core/routing/       # AppRouter and route configurations
│   ├── modules/
│   │   ├── auth/           # Login, registration, role guards
│   │   ├── candidate/      # Candidate dashboard, profile, applications
│   │   ├── hr/             # HR dashboard, all profiles, Kanban applications, onboarding
│   │   └── landing/        # Landing page
│   ├── shared/utils/       # Shared image compressor and helpers
│   ├── api.js              # Central Axios API client
│   └── index.js            # React application entrypoint
├── package.json            # Frontend npm dependencies and scripts
├── vite.config.js       # Webpack bundling configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── .gitignore              # Git ignore rules
│
└── HR-Backend/             # FastAPI Python Backend
    ├── app/
    │   ├── routers/        # API routers (auth_router.py, candidate.py, hr.py)
    │   ├── utils/          # File upload handlers
    │   ├── auth.py         # JWT and password hashing
    │   ├── database.py     # SQLAlchemy DB connection
    │   ├── dependencies.py # Role authorization guards
    │   ├── models.py       # PostgreSQL database schema models
    │   ├── schemas.py      # Pydantic request/response schemas
    │   └── main.py         # FastAPI application entrypoint & auto-migrations
    ├── uploads/            # Candidate documents directory
    ├── .env.example        # Environment variable template
    ├── requirements.txt    # Python backend dependencies
    ├── application.py      # Deployment entrypoint (AWS Elastic Beanstalk)
    ├── Procfile            # Deployment process definition
    └── seed_hr.py          # Seed script for initial HR admin and departments
```

---

## 🚀 Quick Setup & Run Guide

### 1. Backend Setup (FastAPI + PostgreSQL)

1. Open a terminal and navigate to `HR-Backend`:
   ```bash
   cd HR-Backend
   ```

2. Create and activate a Python virtual environment:
   * **Windows:**
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   * Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   * Open `.env` and set your PostgreSQL database connection:
     ```env
     DATABASE_URL=postgresql://<username>:<password>@localhost:5432/hr_onboarding
     PORT=8000
     ```

5. (Optional) Seed initial HR admin and company departments:
   ```bash
   python seed_hr.py
   ```

6. Start the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   * API will run at: `http://localhost:8000`
   * Interactive API docs (Swagger): `http://localhost:8000/docs`

---

### 2. Frontend Setup (React)

1. Open a new terminal in the project root directory:
   ```bash
   cd .. # (or your root Hrapp directory)
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm start
   ```
   * Frontend will open automatically at: `http://localhost:3000`

---

## 🔑 Default Credentials (from Seed)

* **HR Admin Email:** `hrautocratengineers@gmail.com`
* **HR Admin Password:** `Hradmin@123`
* **Role:** `HR`

---

## 📦 Production Build & Deployment

* **Build Frontend Bundle:**
  ```bash
  npm run build
  ```
  Generates production-ready distribution in `dist/`.

* **Production Backend Server:**
  ```bash
  gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
  ```
