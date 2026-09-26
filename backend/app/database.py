"""Database connection helpers for MySQL using mysql-connector-python.

This module reads connection details from environment variables and
provides simple helpers to open and close a connection.

Environment variables used:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=roo123
MYSQL_DATABASE=querypulse
- MYSQL_CONNECT_TIMEOUT (optional, seconds)

Functions:
- get_connection() -> mysql.connector.connection.MySQLConnection
- close_connection(connection) -> None

Raise:
- ValueError when required configuration is missing or invalid
- ConnectionError when a connection to the database cannot be established
- TypeError when close_connection is called with an invalid object
"""

from __future__ import annotations

import os
from typing import Optional
from urllib.parse import quote_plus

import mysql.connector
from sqlalchemy import create_engine
from functools import lru_cache
from mysql.connector import Error as MySQLError


def _get_env_var(name: str, required: bool = True) -> Optional[str]:
    value = os.getenv(name)
    if required and (value is None or value.strip() == ""):
        raise ValueError(f"Environment variable '{name}' is required but not set")
    return value


def get_connection() -> mysql.connector.connection.MySQLConnection:
    """Create and return a MySQL connection using environment variables.

    The function validates required environment variables and attempts
    to establish a connection. On failure it raises a ConnectionError
    with details from the underlying mysql-connector exception.

    Returns:
        mysql.connector.connection.MySQLConnection: an open connection object.

    Raises:
        ValueError: if required environment variables are missing or invalid.
        ConnectionError: if the connector fails to establish a connection.
    """

    host = _get_env_var("MYSQL_HOST")
    user = _get_env_var("MYSQL_USER")
    password = _get_env_var("MYSQL_PASSWORD")
    database = _get_env_var("MYSQL_DATABASE")

    port_raw = _get_env_var("MYSQL_PORT", required=False)
    port: int = 3306
    if port_raw:
        try:
            port = int(port_raw)
        except ValueError:
            raise ValueError("Environment variable 'MYSQL_PORT' must be an integer")

    timeout_raw = _get_env_var("MYSQL_CONNECT_TIMEOUT", required=False)
    connect_timeout: Optional[int] = None
    if timeout_raw:
        try:
            connect_timeout = int(timeout_raw)
        except ValueError:
            raise ValueError("Environment variable 'MYSQL_CONNECT_TIMEOUT' must be an integer (seconds)")

    try:
        connect_kwargs = {
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "database": database,
        }
        if connect_timeout is not None:
            connect_kwargs["connection_timeout"] = connect_timeout

        conn = mysql.connector.connect(**connect_kwargs)

        if not conn.is_connected():
            # Some connectors may not raise on connect; verify state.
            raise ConnectionError("Connection was created but is not in connected state")

        return conn

    except MySQLError as exc:
        # Surface a clear, actionable message while keeping original exception info
        raise ConnectionError(f"Failed to connect to MySQL: {exc}") from exc


def close_connection(connection: Optional[mysql.connector.connection.MySQLConnection]) -> None:
    """Close a MySQL connection returned by `get_connection()`.

    This function is idempotent: passing None or a connection that is
    already closed will do nothing. If the provided object does not
    resemble a mysql.connector connection, a TypeError is raised.

    Args:
        connection: The connection object to close.

    Raises:
        TypeError: if the provided `connection` is not a mysql.connector connection.
        RuntimeError: if an error occurs while closing the connection.
    """

    if connection is None:
        return

    # Basic duck-typing check
    if not hasattr(connection, "is_connected") or not hasattr(connection, "close"):
        raise TypeError("Provided object is not a mysql.connector connection")

    try:
        if connection.is_connected():
            connection.close()
    except MySQLError as exc:
        raise RuntimeError(f"Error closing MySQL connection: {exc}") from exc


@lru_cache(maxsize=1)
def get_sqlalchemy_engine():
    """Return a SQLAlchemy engine using DATABASE_URL or legacy MySQL settings."""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        if database_url.startswith(('postgres://', 'postgresql://')):
            database_url = 'postgresql+psycopg://' + database_url.split('://', 1)[1]
        return create_engine(database_url, pool_pre_ping=True, pool_size=2, max_overflow=3)

    host = _get_env_var("MYSQL_HOST")
    user = _get_env_var("MYSQL_USER")
    password = _get_env_var("MYSQL_PASSWORD")
    database = _get_env_var("MYSQL_DATABASE")
    port = _get_env_var("MYSQL_PORT", required=False) or "3306"

    return create_engine(
        f"mysql+mysqlconnector://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{database}",
        pool_pre_ping=True,
    )
