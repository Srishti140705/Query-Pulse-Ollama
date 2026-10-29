"""Private SQLite SQL workspaces, kept separate from account credentials."""
import os
import sqlite3
import time
from pathlib import Path

class QueryExecutor:
    def __init__(self, database='sqlite', user_id=None):
        if database != 'sqlite':
            raise ValueError('Select the SQLite workspace for execution. Other dialects are supported for analysis only.')
        if user_id is None:
            raise ValueError('A signed-in user is required.')
        folder = Path(os.getenv('QUERYPULSE_DATA_DIR', str(Path(__file__).resolve().parents[2] / 'data'))) / 'workspaces'
        folder.mkdir(parents=True, exist_ok=True)
        self.path = folder / f'{int(user_id)}.db'

    def execute(self, query):
        conn = sqlite3.connect(self.path, timeout=5)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute('CREATE TABLE IF NOT EXISTS _querypulse_initialized (version INTEGER)')
            if not conn.execute('SELECT 1 FROM _querypulse_initialized').fetchone():
                conn.execute('CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT NOT NULL, department TEXT, salary REAL)')
                conn.executemany('INSERT INTO employees VALUES (?, ?, ?, ?)', [(1, 'Alex', 'Engineering', 85000), (2, 'Sam', 'Design', 72000), (3, 'Taylor', 'Engineering', 92000), (4, 'Jordan', 'Operations', 65000)])
                conn.execute('INSERT INTO _querypulse_initialized VALUES (1)')
                conn.commit()
            deadline = time.monotonic() + 30
            conn.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
            denied = {sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_PRAGMA}
            def authorize(action, arg1, arg2, db, trigger):
                if action in denied or (action == sqlite3.SQLITE_FUNCTION and arg2 == 'load_extension') or arg1 == '_querypulse_initialized':
                    return sqlite3.SQLITE_DENY
                return sqlite3.SQLITE_OK
            conn.set_authorizer(authorize)
            cursor = conn.execute(query)
            if cursor.description:
                columns = [item[0] for item in cursor.description]
                rows = cursor.fetchmany(1001)
                result = {'rows': [dict(row) for row in rows[:1000]], 'columns': columns, 'row_count': min(len(rows), 1000), 'truncated': len(rows) > 1000}
            else:
                result = {'row_count': max(cursor.rowcount, 0)}
            cursor.close()
            conn.commit()
            return result
        finally:
            conn.close()
