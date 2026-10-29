"""Add current login fields to the legacy MySQL profile table without deleting rows.

Run from backend with: venv/Scripts/python.exe scripts/repair_legacy_users.py
Old profiles have no password and cannot sign in until credentials are established.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app  # Loads the existing backend .env.
from app.database import get_sqlalchemy_engine
from sqlalchemy import inspect, text


def repair():
    engine = get_sqlalchemy_engine()
    if engine.dialect.name != 'mysql':
        raise RuntimeError('This repair is only for the legacy MySQL users table.')
    columns = {column['name']: column for column in inspect(engine).get_columns('users')}
    with engine.begin() as connection:
        if 'username' not in columns:
            connection.execute(text('ALTER TABLE users ADD COLUMN username VARCHAR(50) NULL'))
        if 'password_hash' not in columns:
            connection.execute(text('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL'))
        if getattr(columns['email']['type'], 'length', 255) < 255:
            connection.execute(text('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL'))
        indexes = {index['name'] for index in inspect(connection).get_indexes('users')}
        if 'uq_users_login_username' not in indexes:
            connection.execute(text('CREATE UNIQUE INDEX uq_users_login_username ON users (username)'))
        # Legacy duplicate email addresses remain untouched. Enforce uniqueness
        # for accounts with credentials through a generated nullable column.
        if 'auth_email' not in columns:
            connection.execute(text('ALTER TABLE users ADD COLUMN auth_email VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN password_hash IS NOT NULL THEN email ELSE NULL END) STORED'))
        if 'uq_users_login_email' not in indexes:
            connection.execute(text('CREATE UNIQUE INDEX uq_users_login_email ON users (auth_email)'))
    print('Legacy login schema repaired. Existing rows preserved.')


if __name__ == '__main__':
    repair()
