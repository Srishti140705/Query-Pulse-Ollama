from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
import hashlib
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from functools import lru_cache

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_sqlalchemy_engine
from app.models import AppSetting, Base, User
from app.api.parser import SQLParser
from app.api.analyzer import QueryAnalyzer
from app.api.query_executor import QueryExecutor

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def ensure_schema():
    engine = get_sqlalchemy_engine()
    Base.metadata.create_all(engine)
    return engine


@lru_cache(maxsize=1)
def jwt_secret():
    configured = os.getenv('JWT_SECRET_KEY')
    if configured:
        return configured
    engine = ensure_schema()
    with Session(engine) as session:
        setting = session.get(AppSetting, 'jwt_secret')
        if setting is None:
            setting = AppSetting(key='jwt_secret', value=secrets.token_urlsafe(48))
            session.add(setting)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()
                setting = session.get(AppSetting, 'jwt_secret')
        return setting.value

@asynccontextmanager
async def lifespan(app):
    ensure_schema()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
security = HTTPBearer(auto_error=False)

def user_json(user):
    return {'id': user.id, 'username': user.username, 'email': user.email, 'created_at': user.created_at}

def password_version(user):
    return hashlib.sha256((user.password_hash or '').encode()).hexdigest()

def token_for(user, purpose='access', minutes=60):
    return jwt.encode({'sub': str(user.id), 'purpose': purpose, 'version': password_version(user), 'exp': datetime.now(timezone.utc) + timedelta(minutes=minutes)}, jwt_secret(), algorithm='HS256')

def user_from_token(token, purpose='access'):
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=['HS256'])
        if payload.get('purpose') != purpose:
            raise ValueError()
        with Session(get_sqlalchemy_engine()) as session:
            user = session.get(User, int(payload['sub']))
            if user is None or payload.get('version') != password_version(user):
                raise ValueError()
            return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, 'Your session or reset link has expired. Please sign in again or request a new link.')

def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(401, 'Please sign in.')
    return user_from_token(credentials.credentials)

class PasswordRequest(BaseModel):
    password: str
    @field_validator('password')
    @classmethod
    def valid_password(cls, value):
        if len(value) < 8 or len(value.encode('utf-8')) > 72:
            raise ValueError('Password must contain at least 8 characters and at most 72 UTF-8 bytes.')
        return value

class RegisterRequest(PasswordRequest):
    username: str
    email: str
    @field_validator('username')
    @classmethod
    def valid_username(cls, value):
        value = value.strip()
        if not value or len(value) > 50:
            raise ValueError('Username must contain 1–50 characters.')
        return value
    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if len(value) > 255 or not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', value):
            raise ValueError('A valid email address is required.')
        return value

@app.post('/register', status_code=201)
def register(request: RegisterRequest):
    with Session(ensure_schema()) as session:
        if session.scalar(select(User.id).where(User.email == request.email)) is not None:
            raise HTTPException(409, 'Username or email is already registered.')
        user = User(username=request.username, email=request.email, password_hash=bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode())
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, 'Username or email is already registered.')
        session.refresh(user)
        return user_json(user)

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post('/login')
def login(request: LoginRequest):
    with Session(ensure_schema()) as session:
        user = session.scalar(select(User).where(User.email == request.email.strip().lower()))
        if len(request.password.encode()) > 72 or user is None or not user.password_hash or not bcrypt.checkpw(request.password.encode(), user.password_hash.encode()):
            raise HTTPException(401, 'Invalid email or password.')
        return {'access_token': token_for(user, minutes=int(os.getenv('JWT_EXPIRE_MINUTES') or '60')), 'token_type': 'bearer', 'user': user_json(user)}

@app.get('/auth/me')
def me(user=Depends(current_user)):
    return user_json(user)

class ChangePasswordRequest(PasswordRequest):
    current_password: str

@app.post('/auth/change-password')
def change_password(request: ChangePasswordRequest, user=Depends(current_user)):
    if len(request.current_password.encode()) > 72 or not bcrypt.checkpw(request.current_password.encode(), user.password_hash.encode()):
        raise HTTPException(400, 'Current password is incorrect.')
    with Session(get_sqlalchemy_engine()) as session:
        stored = session.get(User, user.id)
        stored.password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()
        session.commit()
        return {'message': 'Password updated.', 'access_token': token_for(stored)}

class ForgotRequest(BaseModel):
    email: str

@app.post('/auth/forgot-password')
def forgot_password(request: ForgotRequest):
    if not os.getenv('SMTP_HOST') or not os.getenv('SMTP_FROM') or not os.getenv('FRONTEND_URL'):
        raise HTTPException(503, 'Password recovery email is not configured. Contact the site administrator.')
    with Session(get_sqlalchemy_engine()) as session:
        user = session.scalar(select(User).where(User.email == request.email.strip().lower()))
        if user:
            message = EmailMessage()
            message['Subject'] = 'Reset your QueryPulse password'
            message['From'] = os.environ['SMTP_FROM']
            message['To'] = user.email
            message.set_content(f"Reset your password within 15 minutes: {os.environ['FRONTEND_URL'].rstrip('/')}/reset-password?token={token_for(user, 'reset', 15)}")
            try:
                with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT', '587')), timeout=10) as smtp:
                    smtp.starttls()
                    if os.getenv('SMTP_USER'):
                        smtp.login(os.environ['SMTP_USER'], os.getenv('SMTP_PASSWORD', ''))
                    smtp.send_message(message)
            except (OSError, smtplib.SMTPException):
                raise HTTPException(503, 'Unable to send recovery email. Please try again later.')
    return {'message': 'If an account exists for that email, a reset link has been sent.'}

class ResetRequest(PasswordRequest):
    token: str

@app.post('/auth/reset-password')
def reset_password(request: ResetRequest):
    user = user_from_token(request.token, 'reset')
    with Session(get_sqlalchemy_engine()) as session:
        stored = session.get(User, user.id)
        stored.password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()
        session.commit()
    return {'message': 'Password reset successfully. Sign in with your new password.'}

class QueryRequest(BaseModel):
    query: str
    database: Literal['mysql', 'postgresql', 'sqlite', 'mariadb'] = 'sqlite'
    @field_validator('query')
    @classmethod
    def valid_query(cls, value):
        if not value.strip() or len(value) > 100000:
            raise ValueError('Enter a SQL statement of at most 100,000 characters.')
        return value

@app.post('/ai/explain')
def ai_explain(request: QueryRequest, user=Depends(current_user)):
    from app.api.ollama import explain_sql
    return explain_sql(request.query, request.database)

@app.get('/databases')
def databases(user=Depends(current_user)):
    return [{'value': 'sqlite', 'label': 'SQLite workspace'}]

@app.post('/query')
def execute_query(request: QueryRequest, user=Depends(current_user)):
    try:
        parsed = SQLParser().parse(request.query, dialect=request.database)
        if parsed['query_type'] not in {'SELECT', 'UNION', 'INTERSECT', 'EXCEPT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'}:
            raise ValueError('This statement type is not supported in the workspace.')
        return {'query': request.query, 'result': QueryExecutor(request.database, user.id).execute(request.query)}
    except Exception as error:
        raise HTTPException(400, str(error))

@app.post('/analyze')
def analyze_query(request: QueryRequest, user=Depends(current_user)):
    try:
        parsed = SQLParser().parse(request.query, dialect=request.database)
        return {'parsed': parsed, 'analysis': QueryAnalyzer(parsed).analyze()}
    except Exception as error:
        raise HTTPException(400, str(error))

@app.get('/')
def home():
    return {'message': 'Welcome to QueryPulse!'}

@app.get('/health')
def health():
    with get_sqlalchemy_engine().connect() as connection:
        from sqlalchemy import text
        connection.execute(text('SELECT 1'))
    return {'status': 'healthy', 'project': 'QueryPulse'}
