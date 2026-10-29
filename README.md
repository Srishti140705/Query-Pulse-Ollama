# QueryPulse

For current setup, deployment, verified features, and configuration requirements, see [Running QueryPulse](docs/RUNNING.md). The roadmap below describes the original project plan.

A modern SQL developer workspace for writing, analyzing, optimizing, and managing SQL queries.

---

## About

QueryPulse is a full-stack SQL developer platform built with React and FastAPI.

The project aims to provide developers with a modern environment to:

- Write SQL queries
- Analyze SQL structure
- Execute queries
- Track query history
- Manage SQL workspaces
- Receive AI-powered query insights (planned)

Unlike traditional SQL editors, QueryPulse focuses on improving developer productivity through intelligent tooling and a clean user experience.

---

## Current Features

### Backend

- SQL query parsing using SQLGlot
- SQL analysis API
- REST API built with FastAPI
- Query execution architecture (extensible)
- Modular backend design

### Frontend

- Responsive React dashboard
- Interactive SQL editor interface
- User authentication pages
  - Login
  - Register
  - Forgot Password
  - Reset Password
- Protected routes
- User profile page
- Settings page
- Query history page
- Light & Dark theme support
- Reusable UI component library

### Developer Experience

- FastAPI automatic API documentation
- Modular project structure
- Git version control with sprint-based development

---

## Planned Features

- MySQL / PostgreSQL database connectivity
- Execute SQL queries against live databases
- Save and organize SQL queries
- Query execution history
- AI-powered SQL optimization
- AI query explanation
- Execution plan visualization
- Performance analytics dashboard
- Docker deployment
- CI/CD pipeline

---

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- React Router
- JavaScript (ES6+)

### Backend

- Python
- FastAPI
- Pydantic
- SQLGlot

### Development Tools

- Git
- GitHub
- VS Code

### Planned Integrations

- MySQL / PostgreSQL
- Docker
- OpenAI / Gemini API

---

## Project Structure

```text
QueryPulse/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── main.py
│   │   ├── database.py
│   │   └── logger.py
│   ├── tests/
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── theme/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

# Installation

## 1. Clone the repository

```bash
git clone https://github.com/Kaviiik/QueryPulse.git
```

## 2️. Navigate to the project

```bash
cd QueryPulse
```

---

## Backend Setup

Navigate to the backend folder.

```bash
cd backend
```

Create a virtual environment.

```bash
python -m venv venv
```

Activate it.

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies.

```bash
pip install -r requirements.txt
```

Start the FastAPI server.

```bash
uvicorn app.main:app --reload
```

Backend runs on

```
http://127.0.0.1:8000
```

---

## Frontend Setup

Open another terminal.

```bash
cd frontend
```

Install packages.

```bash
npm install
```

Run the development server.

```bash
npm run dev
```

Frontend runs on

```
http://localhost:5173
```

---

# API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Welcome endpoint |
| `/health` | GET | Health check |
| `/query` | POST | Execute SQL query |
| `/analyze` | POST | Analyze SQL query |

---

# Development Roadmap

## Completed

- Project initialization
- FastAPI backend setup
- SQL parser implementation
- SQL analysis API
- React frontend
- Authentication UI
- Responsive dashboard
- Theme support

## In Progress

- Database connectivity
- SQL query execution
- Query history

## Planned

- Saved queries
- AI-powered SQL optimization
- Query explanation
- Execution plan visualization
- Performance analytics dashboard
- Docker support
- CI/CD pipeline
- Cloud deployment

---

# Author

**Kavneet Kaur Kala**

B.Tech Computer Science Engineering  
Big Data Engineering Specialization

GitHub: https://github.com/Kaviiik

LinkedIn: *(Add your LinkedIn profile URL here)*

---

Thank you for visiting this repository. Feedback, suggestions, and contributions are always welcome.