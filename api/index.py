"""Vercel serverless entry point for the QueryPulse FastAPI backend."""
from pathlib import Path
import os
import sys
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / 'backend'
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Vercel functions can only write persistent-looking local files under /tmp.
# This keeps preview deployments functional; use an external database for
# production data that must survive function restarts.
os.environ.setdefault('QUERYPULSE_DATA_DIR', '/tmp/querypulse')
if not os.getenv('AUTH_DATABASE_URL'):
    os.environ['AUTH_DATABASE_URL'] = os.getenv('DATABASE_URL') or 'sqlite:////tmp/querypulse/accounts.db'

from app.main import app


@app.middleware('http')
async def strip_public_api_prefix(request, call_next):
    # Vercel exposes this function at /api. The rewrite stores the original
    # wildcard in ?path= so nested FastAPI routes are not discarded.
    rewritten_path = parse_qs(request.scope.get('query_string', b'').decode()).get('path', [None])[0]
    if rewritten_path is not None:
        request.scope['path'] = '/' + rewritten_path.lstrip('/')
        request.scope['raw_path'] = request.scope['path'].encode()
    else:
        path = request.scope['path']
        if path == '/api' or path.startswith('/api/'):
            request.scope['path'] = path[4:] or '/'
            request.scope['raw_path'] = request.scope['path'].encode()
    return await call_next(request)
