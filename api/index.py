"""Vercel serverless entry point for the QueryPulse FastAPI backend."""
from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / 'backend'
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Vercel functions can only write persistent-looking local files under /tmp.
# This keeps preview deployments functional; use an external database for
# production data that must survive function restarts.
os.environ.setdefault('QUERYPULSE_DATA_DIR', '/tmp/querypulse')
os.environ.setdefault('AUTH_DATABASE_URL', 'sqlite:////tmp/querypulse/accounts.db')

from app.main import app


@app.middleware('http')
async def strip_public_api_prefix(request, call_next):
    path = request.scope['path']
    if path == '/api' or path.startswith('/api/'):
        request.scope['path'] = path[4:] or '/'
        request.scope['raw_path'] = request.scope['path'].encode()
    return await call_next(request)
