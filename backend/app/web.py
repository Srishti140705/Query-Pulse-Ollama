import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from app.main import app as api, lifespan

class SPAFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or Path(path).suffix or path.startswith('assets/'):
                raise
            return await super().get_response('index.html', scope)

app = FastAPI(lifespan=lifespan)
app.mount('/api', api)
frontend = Path(os.getenv('FRONTEND_DIST', str(Path(__file__).resolve().parents[2] / 'frontend' / 'dist')))
app.mount('/', SPAFiles(directory=frontend, html=True), name='frontend')
