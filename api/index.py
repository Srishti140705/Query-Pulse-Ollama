"""Vercel function entry point. Requests retain their public /api prefix."""
from pathlib import Path
import sys
BACKEND_DIR = Path(__file__).resolve().parent.parent / 'backend'
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
from app.main import app

@app.middleware('http')
async def route_api_prefix(request, call_next):
    path = request.scope['path']
    if path == '/api' or path.startswith('/api/'):
        request.scope['path'] = path[4:] or '/'
        request.scope['raw_path'] = request.scope['path'].encode()
    return await call_next(request)
