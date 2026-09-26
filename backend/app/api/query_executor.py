from __future__ import annotations

from time import perf_counter
from typing import Any, Dict, List, Optional

import mysql.connector

from app.database import get_connection, close_connection


class QueryExecutor:
    """Execute one MySQL statement and return a consistent JSON result."""

    def __init__(self, database: str = 'mysql', owner_id: int | None = None) -> None:
        self.database = database
        self.owner_id = owner_id

    def connection(self):
        if self.owner_id is None:
            raise ValueError('A signed-in account and active connection are required.')
        from sqlalchemy.orm import Session
        from app.database import get_sqlalchemy_engine
        from app.api.connections import active_connection, open_connection
        with Session(get_sqlalchemy_engine()) as session:
            saved = active_connection(session, self.owner_id)
            return open_connection(saved)

    def execute(self, query: str, statement: Dict[str, Any], params: Optional[tuple] = None) -> Dict[str, Any]:
        """Execute a SELECT, metadata command, DML, DDL, or administrative statement."""
        if self.database not in {'mysql', 'mariadb'}:
            return {'error': f'{self.database} execution adapter is not configured.'}

        conn = None
        cursor = None
        query_type = statement.get("query_type") or "SQL"
        started_at = perf_counter()
        try:
            conn = self.connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params or ())

            rows = cursor.fetchmany(1001) if cursor.with_rows else []
            truncated = len(rows) > 1000
            rows = rows[:1000]
            if cursor.with_rows:
                while cursor.fetchmany(1000):
                    pass
            affected = cursor.rowcount if isinstance(cursor.rowcount, int) and cursor.rowcount > 0 else 0
            last_id = getattr(cursor, "lastrowid", None)

            if query_type == "ROLLBACK":
                conn.rollback()
            else:
                conn.commit()

            if rows:
                message = f"{query_type} returned {len(rows)} row(s)."
            elif statement.get("changes_schema"):
                message = f"{query_type} completed successfully."
            elif statement.get("changes_data"):
                message = f"{query_type} completed successfully; {affected} row(s) affected."
            else:
                message = f"{query_type} completed successfully."

            return {
                "rows": rows,
                "truncated": truncated,
                "row_count": len(rows) if rows else affected,
                "affected_rows": affected,
                "last_row_id": last_id,
                "statement_type": query_type,
                "category": statement.get("category"),
                "message": message,
                "execution_time_ms": max(1, round((perf_counter() - started_at) * 1000)),
            }
        except mysql.connector.Error as exc:
            try:
                if conn is not None:
                    conn.rollback()
            except Exception:
                pass
            return {
                "error": str(exc),
                "statement_type": query_type,
                "category": statement.get("category"),
                "execution_time_ms": max(1, round((perf_counter() - started_at) * 1000)),
            }
        finally:
            if cursor is not None:
                try:
                    cursor.close()
                except Exception:
                    pass
            if conn is not None:
                try:
                    close_connection(conn)
                except Exception:
                    pass

    def execute_select(self, query: str, params: Optional[tuple] = None) -> Dict[str, Any]:
        """Execute a SELECT query and return rows as a list of dictionaries.

        Args:
            query: The SQL SELECT statement to execute.
            params: Optional tuple of parameters for parameterized queries.

        Returns:
            A dictionary with keys:
              - "rows": List[Dict[str, Any]] (result rows)
              - "row_count": int
              - "error": str (only present on failure)
        """
        if self.database not in {'mysql', 'mariadb'}:
            return {'error': f'{self.database} execution adapter is not configured.'}

        conn = None
        cursor = None
        try:
            conn = self.connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params or ())
            rows = cursor.fetchall()
            # Ensure all values are JSON-serializable; mysql-connector returns native types
            return {"rows": rows, "row_count": len(rows)}

        except mysql.connector.Error as exc:
            # Return a JSON-friendly error description
            return {"error": str(exc)}

        finally:
            if cursor is not None:
                try:
                    cursor.close()
                except Exception:
                    pass
            if conn is not None:
                try:
                    close_connection(conn)
                except Exception:
                    pass

    def explain_query(self, query: str) -> Dict[str, Any]:
        """Return MySQL's real execution plan without running supported DML."""
        if self.database not in {'mysql', 'mariadb'}:
            return {'error': f'{self.database} EXPLAIN adapter is not configured.'}

        conn = None
        cursor = None
        try:
            conn = self.connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(f"EXPLAIN {query}")
            steps = cursor.fetchall()
            normalized_steps = []
            for step in steps:
                normalized_steps.append({
                    "id": step.get("id"),
                    "select_type": step.get("select_type"),
                    "table": step.get("table"),
                    "access_type": step.get("type"),
                    "possible_keys": step.get("possible_keys"),
                    "key": step.get("key"),
                    "estimated_rows": step.get("rows"),
                    "filtered_percent": step.get("filtered"),
                    "extra": step.get("Extra"),
                })
            return {
                "plan_kind": "database",
                "strategy": "MySQL generated this native EXPLAIN plan without executing the statement.",
                "steps": normalized_steps,
                "step_count": len(normalized_steps),
                "database": self.database,
            }
        except mysql.connector.Error as exc:
            return {"error": str(exc)}
        finally:
            if cursor is not None:
                try:
                    cursor.close()
                except Exception:
                    pass
            if conn is not None:
                try:
                    close_connection(conn)
                except Exception:
                    pass

    def explain_select(self, query: str) -> Dict[str, Any]:
        """Backward-compatible alias for callers that still use the old name."""
        return self.explain_query(query)

    def execute_write(self, query: str, params: Optional[tuple] = None) -> Dict[str, Any]:
        """Execute a write query (INSERT/UPDATE/DELETE) and commit the transaction.

        Args:
            query: The SQL statement to execute.
            params: Optional tuple of parameters for parameterized queries.

        Returns:
            A dictionary with keys:
              - "row_count": int (number of affected rows)
              - "last_row_id": Optional[int] (for inserts; may be None)
              - "error": str (only present on failure)
        """
        if self.database not in {'mysql', 'mariadb'}:
            return {'error': f'{self.database} execution adapter is not configured.'}

        conn = None
        cursor = None
        try:
            conn = self.connection()
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            affected = cursor.rowcount
            last_id = getattr(cursor, "lastrowid", None)
            # Commit the transaction
            conn.commit()
            return {"row_count": affected, "last_row_id": last_id}

        except mysql.connector.Error as exc:
            # Attempt to rollback on error if possible
            try:
                if conn is not None:
                    conn.rollback()
            except Exception:
                pass
            return {"error": str(exc)}

        finally:
            if cursor is not None:
                try:
                    cursor.close()
                except Exception:
                    pass
            if conn is not None:
                try:
                    close_connection(conn)
                except Exception:
                    pass
