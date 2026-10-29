import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TEST_DATA = tempfile.TemporaryDirectory(prefix='querypulse-tests-')
os.environ['QUERYPULSE_DATA_DIR'] = TEST_DATA.name
os.environ['AUTH_DATABASE_URL'] = 'sqlite:///' + (Path(TEST_DATA.name) / 'accounts.db').as_posix()
os.environ['JWT_SECRET_KEY'] = 'test-only-secret-with-more-than-thirty-two-characters'
from fastapi.testclient import TestClient
from app.main import app, token_for
from app.database import get_sqlalchemy_engine
from app.models import User
from sqlalchemy import select
from sqlalchemy.orm import Session

class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        get_sqlalchemy_engine().dispose()
        TEST_DATA.cleanup()

    def account(self, name):
        response = self.client.post('/register', json={'username': name, 'email': name + '@example.com', 'password': 'test-password'})
        self.assertEqual(response.status_code, 201, response.text)
        response = self.client.post('/login', json={'email': name + '@example.com', 'password': 'test-password'})
        self.assertEqual(response.status_code, 200, response.text)
        return {'Authorization': 'Bearer ' + response.json()['access_token']}

    def query(self, sql, headers):
        return self.client.post('/query', json={'query': sql, 'database': 'sqlite'}, headers=headers)

    def test_passwordless_legacy_account_and_duplicate_email(self):
        self.account('legacy')
        with Session(get_sqlalchemy_engine()) as session:
            user = session.scalar(select(User).where(User.username == 'legacy'))
            user.password_hash = ''
            session.commit()
        response = self.client.post('/login', json={'email': 'legacy@example.com', 'password': 'test-password'})
        self.assertEqual(response.status_code, 401)
        response = self.client.post('/register', json={'username': 'another-name', 'email': 'legacy@example.com', 'password': 'test-password'})
        self.assertEqual(response.status_code, 409)

    def test_auth_password_and_expired_sessions(self):
        headers = self.account('account')
        self.assertEqual(self.client.get('/auth/me', headers=headers).json()['username'], 'account')
        duplicate = self.client.post('/register', json={'username': 'account', 'email': 'account@example.com', 'password': 'test-password'})
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(self.client.post('/auth/change-password', headers=headers, json={'current_password': 'wrong', 'password': 'new-password'}).status_code, 400)
        response = self.client.post('/auth/change-password', headers=headers, json={'current_password': 'test-password', 'password': 'new-password'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get('/auth/me', headers=headers).status_code, 401)
        fresh = {'Authorization': 'Bearer ' + response.json()['access_token']}
        self.assertEqual(self.client.get('/auth/me', headers=fresh).status_code, 200)
        self.assertEqual(self.client.post('/login', json={'email': 'account@example.com', 'password': 'test-password'}).status_code, 401)
        self.assertEqual(self.client.post('/login', json={'email': 'account@example.com', 'password': 'new-password'}).status_code, 200)

    def test_queries_persist_and_accounts_are_isolated(self):
        first, second = self.account('first'), self.account('second')
        result = self.query('SELECT * FROM employees ORDER BY id', first)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['result']['row_count'], 4)
        for sql in ['CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)', "INSERT INTO notes VALUES (1, 'Hello, world')", "UPDATE notes SET body = 'Updated' WHERE id = 1"]:
            result = self.query(sql, first)
            self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.query('SELECT body FROM notes', first).json()['result']['rows'][0]['body'], 'Updated')
        self.assertEqual(self.query('SELECT * FROM notes', second).status_code, 400)
        self.assertEqual(self.query('DELETE FROM notes WHERE id = 1', first).json()['result']['row_count'], 1)
        self.assertEqual(self.query('SELECT * FROM notes', first).json()['result']['rows'], [])
        self.assertEqual(self.query('DROP TABLE notes', first).status_code, 200)

    def test_invalid_and_unsafe_queries(self):
        headers = self.account('safe')
        self.assertEqual(self.query('SELECT 1', {}).status_code, 401)
        for sql in ['', 'SELECT 1; SELECT 2', "ATTACH DATABASE 'accounts.db' AS account", 'PRAGMA database_list', 'SELECT * FROM users', "SELECT load_extension('example')", 'DELETE FROM _querypulse_initialized']:
            self.assertIn(self.query(sql, headers).status_code, [400, 422], sql)
        self.assertEqual(self.query('WITH value AS (SELECT 1 AS n) SELECT n FROM value', headers).json()['result']['rows'], [{'n': 1}])
        self.assertEqual(self.query('SELECT 1 AS n UNION SELECT 2', headers).status_code, 200)
        result = self.query('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1100) SELECT x FROM n', headers)
        self.assertTrue(result.json()['result']['truncated'])
        self.assertEqual(len(result.json()['result']['rows']), 1000)

    def test_analysis_and_reset_link(self):
        headers = self.account('analysis')
        result = self.client.post('/analyze', headers=headers, json={'query': 'SELECT * FROM employees', 'database': 'sqlite'})
        self.assertEqual(result.status_code, 200)
        self.assertIn('Use of SELECT * or table.* found', result.json()['analysis']['warnings'])
        with Session(get_sqlalchemy_engine()) as session:
            user = session.scalar(select(User).where(User.username == 'analysis'))
            token = token_for(user, 'reset', 15)
        self.assertEqual(self.client.get('/auth/me', headers={'Authorization': 'Bearer ' + token}).status_code, 401)
        reset = {'token': token, 'password': 'reset-password'}
        self.assertEqual(self.client.post('/auth/reset-password', json=reset).status_code, 200)
        self.assertEqual(self.client.post('/auth/reset-password', json=reset).status_code, 401)
        with patch.dict(os.environ, {'SMTP_HOST': ''}):
            self.assertEqual(self.client.post('/auth/forgot-password', json={'email': 'analysis@example.com'}).status_code, 503)

if __name__ == '__main__':
    unittest.main()
