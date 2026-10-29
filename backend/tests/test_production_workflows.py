"""Regression tests for the actual Vercel / Neon application."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'backend'))
TEMP = tempfile.TemporaryDirectory(prefix='querypulse-production-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(TEMP.name) / 'accounts.db').as_posix()
os.environ['JWT_SECRET_KEY'] = 'test-only-long-jwt-secret-not-for-production'
os.environ['CONNECTION_ENCRYPTION_KEY'] = Fernet.generate_key().decode()
os.environ['REQUIRE_EMAIL_VERIFICATION'] = 'false'
os.environ['SMTP_HOST'] = ''
os.environ['JWT_EXPIRE_MINUTES'] = ''
from fastapi.testclient import TestClient
from api.index import app
from app.database import get_sqlalchemy_engine
from app.models import Base, SavedConnection
from sqlalchemy.orm import Session

class ProductionWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        get_sqlalchemy_engine.cache_clear()
        Base.metadata.create_all(get_sqlalchemy_engine())

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        get_sqlalchemy_engine().dispose()
        TEMP.cleanup()

    def account(self, name):
        response = self.client.post('/api/register', json={'username': name, 'email': name + '@example.test', 'password': 'test-password'})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIn('sign in', response.json()['message'])
        response = self.client.post('/api/login', json={'email': name + '@example.test', 'password': 'test-password'})
        self.assertEqual(response.status_code, 200, response.text)
        return {'Authorization': 'Bearer ' + response.json()['access_token']}, response.json()['user']['id']

    def test_public_ai_review_falls_back_without_backend_session(self):
        response = self.client.post('/api/ai/explain', json={
            'sql': 'SELECT id FROM employees WHERE active = 1;',
            'dialect': 'mysql',
        })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()['provider_available'])
        self.assertTrue(response.json()['deterministic_review']['valid_syntax'])

    def test_vercel_prefix_routes_and_auth(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)
        self.assertEqual(self.client.get('/health').status_code, 200)
        headers, uid = self.account('routing')
        self.assertEqual(self.client.get('/api/auth/me', headers=headers).json()['id'], uid)
        self.assertEqual(self.client.post('/api/login', json={'email': 'routing@example.test', 'password': 'wrong'}).status_code, 401)
        self.assertEqual(self.client.get('/api/workspace/queries').status_code, 401)
        self.assertEqual(self.client.post('/api/forgot-password', json={'email': 'routing@example.test'}).status_code, 503)

    def test_missing_connection_is_actionable(self):
        headers, uid = self.account('missing')
        response = self.client.post('/api/query', json={'query': 'SELECT 1', 'database': 'mysql'}, headers=headers)
        self.assertEqual(response.status_code, 400, response.text)
        self.assertIn('No active', response.json()['detail'])
        response = self.client.post('/api/query', json={'query': 'SELECT 1; DELETE FROM users', 'database': 'mysql'}, headers=headers)
        self.assertEqual(response.status_code, 422)

    def test_active_connection_execution_and_history_isolation(self):
        headers, uid = self.account('execute')
        other, other_id = self.account('other')
        with Session(get_sqlalchemy_engine()) as session:
            saved = SavedConnection(user_id=uid, name='Owned DB', host='database.example.test', port=3306, username='reader', password_encrypted='test-only', database_name='analytics', is_active=True)
            session.add(saved)
            session.commit()
        db = MagicMock()
        cursor = db.cursor.return_value
        cursor.with_rows = True
        cursor.rowcount = 1
        cursor.lastrowid = None
        cursor.fetchmany.side_effect = [[{'answer': 42}], []]
        cursor.fetchall.return_value = []
        with patch('app.api.connections.open_connection', return_value=db) as opening:
            response = self.client.post('/api/query', json={'query': 'SELECT 42 AS answer', 'database': 'mysql'}, headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['result']['rows'], [{'answer': 42}])
            self.assertEqual(opening.call_args_list[0].args[0].user_id, uid)
        records = self.client.get('/api/workspace/queries', headers=headers).json()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['sql'], 'SELECT 42 AS answer')
        query_id = records[0]['id']
        self.assertEqual(self.client.get('/api/workspace/queries', headers=other).json(), [])
        self.assertEqual(self.client.patch(f'/api/workspace/queries/{query_id}', json={'is_favorite': True}, headers=other).status_code, 404)
        self.assertTrue(self.client.patch(f'/api/workspace/queries/{query_id}', json={'is_favorite': True}, headers=headers).json()['is_favorite'])
        self.assertEqual(self.client.delete(f'/api/workspace/queries/{query_id}', headers=headers).status_code, 204)
        self.assertEqual(self.client.get('/api/workspace/queries', headers=headers).json(), [])

    def test_verification_required_fails_before_creating_account(self):
        with patch.dict(os.environ, {'REQUIRE_EMAIL_VERIFICATION': 'true', 'SMTP_HOST': ''}):
            response = self.client.post('/api/register', json={'username': 'verify', 'email': 'verify@example.test', 'password': 'test-password'})
            self.assertEqual(response.status_code, 503)
        self.account('verify')

if __name__ == '__main__':
    unittest.main()
