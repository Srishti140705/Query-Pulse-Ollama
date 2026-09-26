from fastapi.middleware.cors import CORSMiddleware
from app.database import close_connection, get_connection, get_sqlalchemy_engine
from app.models import Base, User, UserQuery
from app.api.parser import SQLParser
from app.api.analyzer import QueryAnalyzer
from app.api.query_executor import QueryExecutor
from app.api.statement import classify_statement, operation_plan

from pydantic import BaseModel, field_validator
from typing import Literal
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import bcrypt
import hashlib
import jwt
import os
import re
import secrets
import smtplib

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI()


def smtp_configured():
    return all(os.getenv(key) for key in ('SMTP_HOST', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM'))


def require_verification():
    return os.getenv('REQUIRE_EMAIL_VERIFICATION', 'false').lower() in {'1', 'true', 'yes'}

security = HTTPBearer(auto_error=False)


def jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT_SECRET_KEY is not configured")
    return secret


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at,
        "email_verified": user.email_verified,
    }


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    try:
        return jwt.decode(credentials.credentials, jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
from app.api.connections import router as connections_router
app.include_router(connections_router)
from app.api.ai import router as ai_router
app.include_router(ai_router)
from app.api.workspace import ensure_query_columns, router as workspace_router
app.include_router(workspace_router)



def ensure_user_columns(engine) -> None:
    Base.metadata.create_all(engine)
    existing_columns = {column["name"] for column in inspect(engine).get_columns("app_users")}
    boolean_type = "BOOLEAN" if engine.dialect.name == "postgresql" else "BOOLEAN"
    datetime_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"
    with engine.begin() as connection:
        # Mark legacy accounts as verified when this new column is introduced.
        if "email_verified" not in existing_columns:
            connection.execute(text(f"ALTER TABLE app_users ADD COLUMN email_verified {boolean_type} NOT NULL DEFAULT TRUE"))
        if "email_verification_token_hash" not in existing_columns:
            connection.execute(text("ALTER TABLE app_users ADD COLUMN email_verification_token_hash VARCHAR(64) NULL UNIQUE"))
        if "email_verification_expires_at" not in existing_columns:
            connection.execute(text(f"ALTER TABLE app_users ADD COLUMN email_verification_expires_at {datetime_type} NULL"))
        if "reset_token_hash" not in existing_columns:
            connection.execute(text("ALTER TABLE app_users ADD COLUMN reset_token_hash VARCHAR(64) NULL UNIQUE"))
        if "reset_token_expires_at" not in existing_columns:
            connection.execute(text(f"ALTER TABLE app_users ADD COLUMN reset_token_expires_at {datetime_type} NULL"))


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_email(recipient: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM")
    if not all([host, username, password, sender]):
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(body)
    port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(message)


def frontend_url(path: str) -> str:
    default = "https://" + os.environ["VERCEL_PROJECT_PRODUCTION_URL"] if os.getenv("VERCEL_PROJECT_PRODUCTION_URL") else "http://localhost:3000"
    return os.getenv("FRONTEND_URL", default).rstrip("/") + path


app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str

    @field_validator('query')
    @classmethod
    def validate_query(cls, value):
        from sqlglot.tokens import Tokenizer, TokenType
        if not value.strip() or len(value) > 100000:
            raise ValueError('Enter one SQL statement of at most 100,000 characters.')
        tokens = Tokenizer().tokenize(value)
        if any(token.token_type == TokenType.SEMICOLON for token in tokens[:-1]):
            raise ValueError('Run exactly one SQL statement at a time.')
        return value

    database: Literal['mysql', 'postgresql', 'sqlite', 'mariadb'] = 'mysql'


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Username is required")
        if len(value) > 50:
            raise ValueError("Username must be 50 characters or fewer")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("A valid email address is required")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8 or len(value.encode("utf-8")) > 72:
            raise ValueError("Password must contain at least 8 characters and at most 72 UTF-8 bytes")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8 or len(value.encode("utf-8")) > 72:
            raise ValueError("Password must contain at least 8 characters and at most 72 UTF-8 bytes")
        return value


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    password: str | None = None
    current_password: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value or len(value) > 50:
            raise ValueError("Username must be between 1 and 50 characters")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is not None and (len(value) < 8 or len(value.encode("utf-8")) > 72):
            raise ValueError("Password must contain at least 8 characters and at most 72 UTF-8 bytes")
        return value


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(request: RegisterRequest):
    if require_verification() and not smtp_configured():
        raise HTTPException(503, "Email verification is required, but the email service is not configured.")
    engine = get_sqlalchemy_engine()
    Base.metadata.create_all(engine)
    ensure_user_columns(engine)
    verification_token = secrets.token_urlsafe(32)

    with Session(engine) as session:
        if session.scalar(select(User).where(User.username == request.username)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already registered")
        if session.scalar(select(User).where(User.email == request.email)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
        user = User(
            username=request.username,
            email=request.email,
            password_hash=bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
            email_verified=False,
            email_verification_token_hash=token_hash(verification_token),
            email_verification_expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24),
        )
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email is already registered")
        session.refresh(user)
        message = "Account created. You can now sign in."
        if smtp_configured():
            try:
                send_email(user.email, "Verify your QueryPulse email", f"Verify your account: {os.getenv('BACKEND_URL', frontend_url('/api') if os.getenv('VERCEL') else 'http://localhost:8000').rstrip('/')}/verify-email?token={verification_token}")
                message = "Account created. Check your email to verify it before signing in." if require_verification() else "Account created. You can sign in now; a verification email has also been sent."
            except (RuntimeError, OSError, smtplib.SMTPException):
                if require_verification():
                    session.delete(user)
                    session.commit()
                    raise HTTPException(503, "Verification email could not be sent. Please try registering again later.")
                message = "Account created. You can sign in now. Verification email could not be sent."
        return {"message": message, "user": public_user(user)}



@app.get("/verify-email")
def verify_email(token: str = ""):
    engine = get_sqlalchemy_engine()
    Base.metadata.create_all(engine)
    ensure_user_columns(engine)
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email_verification_token_hash == token_hash(token))) if token else None
        valid = user and user.email_verification_expires_at and user.email_verification_expires_at > datetime.now(timezone.utc).replace(tzinfo=None)
        if not valid:
            return RedirectResponse(frontend_url("/login?verification=error"), status_code=status.HTTP_303_SEE_OTHER)
        user.email_verified = True
        user.email_verification_token_hash = None
        user.email_verification_expires_at = None
        session.commit()
    return RedirectResponse(frontend_url("/login?verification=success"), status_code=status.HTTP_303_SEE_OTHER)


@app.post("/login")
def login_user(request: LoginRequest):
    engine = get_sqlalchemy_engine()
    ensure_user_columns(engine)
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == request.email.strip().lower()))
        if len(request.password.encode("utf-8")) > 72 or user is None or not bcrypt.checkpw(request.password.encode("utf-8"), user.password_hash.encode("utf-8")):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        if require_verification() and not user.email_verified:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before signing in")
        access_token = jwt.encode({"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "60")))}, jwt_secret(), algorithm="HS256")
        return {"access_token": access_token, "token_type": "bearer", "user": public_user(user)}


@app.get("/auth/me")
def current_profile(current_user: dict = Depends(get_current_user)):
    engine = get_sqlalchemy_engine()
    with Session(engine) as session:
        user = session.get(User, int(current_user["sub"]))
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid")
        return public_user(user)


@app.patch("/auth/me")
def update_profile(request: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    if request.username is None and request.password is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide a username or password to update")
    engine = get_sqlalchemy_engine()
    with Session(engine) as session:
        user = session.get(User, int(current_user["sub"]))
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid")
        if request.username and request.username != user.username:
            existing = session.scalar(select(User).where(User.username == request.username))
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already registered")
            user.username = request.username
        if request.password:
            if not request.current_password or len(request.current_password.encode("utf-8")) > 72 or not bcrypt.checkpw(request.current_password.encode("utf-8"), user.password_hash.encode("utf-8")):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Your current password is incorrect")
            user.password_hash = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        session.commit()
        session.refresh(user)
        return public_user(user)


@app.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    if not smtp_configured():
        raise HTTPException(503, "Password recovery email is not configured. Contact the site administrator.")
    engine = get_sqlalchemy_engine()
    Base.metadata.create_all(engine)
    ensure_user_columns(engine)
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email == request.email.strip().lower()))
        if user is not None:
            reset_token = secrets.token_urlsafe(32)
            user.reset_token_hash = token_hash(reset_token)
            user.reset_token_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
            session.commit()
            try:
                send_email(user.email, "Reset your QueryPulse password", f"Reset your password by opening this link:\n\n{frontend_url('/reset-password?token=' + reset_token)}\n\nThis link expires in one hour.")
            except (RuntimeError, OSError, smtplib.SMTPException) as exc:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return {"message": "If an account exists for that email, password reset instructions have been sent."}


@app.post("/reset-password")
def reset_password(request: ResetPasswordRequest):
    engine = get_sqlalchemy_engine()
    Base.metadata.create_all(engine)
    ensure_user_columns(engine)
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.reset_token_hash == token_hash(request.token)))
        if user is None or user.reset_token_expires_at is None or user.reset_token_expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
        user.password_hash = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user.reset_token_hash = None
        user.reset_token_expires_at = None
        session.commit()
    return {"message": "Password reset successfully. You can now sign in."}


@app.post("/query")
def execute_query(request: QueryRequest, current_user: dict = Depends(get_current_user)):
    parser = SQLParser()
    executor = QueryExecutor(request.database, owner_id=int(current_user["sub"]))
    try:
        parsed = parser.parse(request.query, dialect=request.database)
    except Exception as exc:
        parsed = classify_statement(request.query)
        if parsed["query_type"] in {"UNKNOWN", "COMMAND"}:
            return {"error": f"SQL syntax or statement recognition failed: {exc}"}
    try:
        result = executor.execute(request.query, parsed)
        reasons = []
        if result.get("error"):
            reasons.append(f"Execution error: {result['error'][:180]}")
        else:
            if (result.get("row_count") or 0) >= 1000:
                reasons.append("Large result set")
            if parsed.get("query_type") in {"SELECT", "UPDATE", "DELETE"}:
                plan = executor.explain_query(request.query.rstrip().rstrip(";"))
                if not plan.get("error"):
                    steps = plan.get("steps") or []
                    if any(step.get("access_type") == "ALL" for step in steps):
                        reasons.append("Full-table scan")
                    if any(step.get("access_type") == "ALL" and not step.get("key") for step in steps):
                        reasons.append("No index selected")
                    extras = " ".join(str(step.get("extra") or "").lower() for step in steps)
                    if "filesort" in extras:
                        reasons.append("Filesort")
                    if "temporary" in extras:
                        reasons.append("Temporary table")
                    if len(steps) >= 3:
                        reasons.append("Expensive multi-table plan")
        if not reasons:
            elapsed = result.get("execution_time_ms") or 0
            reasons.append("No obvious bottleneck" if elapsed < 200 else "Review data volume and indexes")
        reasons = list(dict.fromkeys(reasons))[:3]
        result["performance_reasons"] = reasons

        try:
            engine = get_sqlalchemy_engine()
            ensure_query_columns(engine)
            with Session(engine) as session:
                record = UserQuery(
                    user_id=int(current_user["sub"]),
                    sql=request.query[:20000],
                    name=f"{parsed.get('query_type') or 'SQL'} execution",
                    query_type=parsed.get("query_type") or "SQL",
                    connection_name=request.database,
                    execution_time_ms=result.get("execution_time_ms"),
                    row_count=result.get("row_count") or 0,
                    performance_reason=" • ".join(reasons),
                    status="error" if result.get("error") else "success",
                )
                session.add(record)
                session.commit()
                session.refresh(record)
                result["history_record"] = {
                    "id": record.id,
                    "sql": record.sql,
                    "query_type": record.query_type,
                    "execution_time_ms": record.execution_time_ms,
                    "row_count": record.row_count,
                    "performance_reason": record.performance_reason,
                    "status": record.status,
                    "created_at": record.created_at,
                }
        except Exception:
            result["history_warning"] = "The query ran, but its performance record could not be saved."
        return {"query": request.query, "parsed": parsed, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/execution-plan")
def execution_plan(request: QueryRequest, current_user: dict = Depends(get_current_user)):
    parser = SQLParser()
    try:
        parsed = parser.parse(request.query, dialect=request.database)
    except Exception as exc:
        parsed = classify_statement(request.query)
        if parsed["query_type"] in {"UNKNOWN", "COMMAND"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"SQL syntax error: {exc}")
        parsed.update({"tables": [], "columns": [], "where_conditions": [], "joins": [], "group_by": [], "order_by": [], "limit": None, "aliases": {}})

    if parsed.get("supports_native_explain"):
        plan = QueryExecutor(request.database, owner_id=int(current_user["sub"])).explain_query(request.query.rstrip().rstrip(";"))
    else:
        plan = operation_plan(parsed)
    if plan.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=plan["error"])
    return {"query": request.query, "parsed": parsed, "plan": plan}


@app.get("/")
def home():
    return {"message": "Welcome to QueryPulse!"}


@app.get("/db-test")
def db_test(current_user: dict = Depends(get_current_user)):
    conn = None
    try:
        conn = get_connection()
        return {"message": "Database connected successfully!"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        if conn:
            close_connection(conn)


@app.get("/health")
def health():
    return {"status": "healthy", "project": "QueryPulse"}


@app.post("/analyze")
def analyze_query(request: QueryRequest, current_user: dict = Depends(get_current_user)):
    parser = SQLParser()
    try:
        parsed = parser.parse(request.query, dialect=request.database)
        from app.api.ai import active_schema_context, deterministic_review, owner_id
        static_analysis = deterministic_review(
            request.query,
            request.database,
            active_schema_context(owner_id(current_user)),
        )
        return {
            "parsed": parsed,
            "analysis": QueryAnalyzer(parsed).analyze(),
            "static_analysis": static_analysis,
        }
    except Exception as e:
        return {"error": str(e)}

