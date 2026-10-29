# Run and deploy QueryPulse

The frontend uses `/api` by default. In development, Vite proxies that path to
FastAPI on port 8000. In production, `app.web:app` serves the built frontend and
API from one origin and supports refreshing routes such as `/editor`.

## Local development

1. Install `backend/requirements.txt` in a Python virtual environment.
2. Copy `backend/.env.example` to `backend/.env` and set a random JWT secret.
   Set `AUTH_DATABASE_URL` explicitly to choose the account database. Existing
   `MYSQL_*` settings remain supported for account storage when that URL is absent.
3. From `backend`, run `python -m uvicorn app.main:app --reload`.
4. From `frontend`, run `npm ci`, then `npm run dev`.

SQL execution uses private SQLite files, one per authenticated account, under
`QUERYPULSE_DATA_DIR/workspaces`. It never executes SQL against the account DB.
New workspaces include four sample employees. MySQL/PostgreSQL/MariaDB dialects
remain available through the analysis API; external database execution is not
configured in this version. Existing external data is not migrated or altered.

History, favorites, drafts, and editor settings are per-account browser storage,
not synchronized across devices. History keeps the latest 500 runs.

## Production

Build the frontend with `npm ci && npm run build` in `frontend`, then run
`uvicorn app.web:app --host 0.0.0.0 --port 8000` from `backend`.
Set `ENVIRONMENT=production` and a strong, stable `JWT_SECRET_KEY`.
`FRONTEND_DIST` can point to a different frontend build directory.
Use HTTPS at your hosting provider and a persistent data volume.

Alternatively, use the supplied Dockerfile and `docker compose up --build -d`.
Set `JWT_SECRET_KEY` in the shell before running Compose. The named volume stores
account data and SQL workspaces. Do not remove that volume during upgrades.
The Docker configuration has not been verified against a hosting provider.

For separately hosted frontend/API deployments, set `VITE_API_URL` at frontend
build time and `CORS_ORIGINS` on the backend to the exact frontend origin.

## Password recovery

Set `SMTP_HOST`, `SMTP_PORT` (587 by default), `SMTP_FROM`, `SMTP_USER`,
`SMTP_PASSWORD`, and `FRONTEND_URL`. SMTP uses STARTTLS. Reset tokens expire after
15 minutes and become invalid once the password changes. Recovery shows a
configuration error until an email service is supplied; it never claims an
unsent email succeeded. Social sign-in buttons are removed because no OAuth
provider was configured. For local AI SQL explanations, see [Ollama setup](OLLAMA.md).

## Verification

Install `backend/requirements-dev.txt`, then run from the repository root:

```
backend/venv/Scripts/python.exe -m unittest discover -s backend/tests -v
```

Tests use isolated temporary SQLite databases. They cover authentication,
password changes, reset-token reuse, query execution and persistence, account
isolation, invalid/multiple SQL statements, result limits, and parser analysis.
