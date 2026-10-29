import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError, HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.api.ollama import explain_sql
from fastapi import HTTPException


class OllamaTests(unittest.TestCase):
    @patch('app.api.ollama.urlopen')
    def test_explanation_and_nonstreaming_request(self, call):
        call.return_value.__enter__.return_value = io.StringIO('{"message":{"content":"Reads rows."}}')
        self.assertEqual(explain_sql('SELECT 1', 'sqlite')['explanation'], 'Reads rows.')
        payload = json.loads(call.call_args.args[0].data)
        self.assertFalse(payload['stream'])
        self.assertIn('SELECT 1', payload['messages'][1]['content'])

    @patch('app.api.ollama.urlopen', side_effect=URLError('offline'))
    def test_offline(self, call):
        with self.assertRaises(HTTPException) as caught:
            explain_sql('SELECT 1', 'sqlite')
        self.assertEqual(caught.exception.status_code, 503)

    @patch('app.api.ollama.urlopen', side_effect=HTTPError('http://localhost', 404, 'missing', {}, None))
    def test_missing_model(self, call):
        with self.assertRaises(HTTPException) as caught:
            explain_sql('SELECT 1', 'sqlite')
        self.assertIn('ollama pull', caught.exception.detail)
