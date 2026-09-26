import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main
from app.api.connections import ConnectionInput, ConnectionUpdate, test_unsaved_connection as check_unsaved_connection


class FakeConnection:
    def __init__(self, connected=True):
        self.connected = connected
        self.closed = False

    def is_connected(self):
        return self.connected

    def close(self):
        self.closed = True


class ConnectionValidationTests(unittest.TestCase):
    def valid_payload(self):
        return {
            "name": "Local MySQL",
            "host": "localhost",
            "port": 3306,
            "username": "root",
            "password": "secret",
            "database_name": "querypulse",
        }

    def test_create_input_trims_required_text(self):
        request = ConnectionInput(**{
            **self.valid_payload(),
            "name": "  Local MySQL  ",
            "host": " localhost ",
        })
        self.assertEqual(request.name, "Local MySQL")
        self.assertEqual(request.host, "localhost")

    def test_create_input_rejects_blank_and_invalid_port(self):
        with self.assertRaises(ValidationError):
            ConnectionInput(**{**self.valid_payload(), "database_name": "   "})
        with self.assertRaises(ValidationError):
            ConnectionInput(**{**self.valid_payload(), "port": 70000})

    def test_update_rejects_whitespace_only_values(self):
        with self.assertRaises(ValidationError):
            ConnectionUpdate(host="   ")

    @patch("app.api.connections.mysql.connector.connect")
    def test_unsaved_connection_uses_all_entered_details(self, connect):
        fake = FakeConnection()
        connect.return_value = fake
        request = ConnectionInput(**self.valid_payload())

        result = check_unsaved_connection(request, {"sub": "1"})

        self.assertEqual(result, {"message": "Connection successful"})
        connect.assert_called_once_with(
            host="localhost",
            port=3306,
            user="root",
            password="secret",
            database="querypulse",
            connection_timeout=10,
        )
        self.assertTrue(fake.closed)

    @patch("app.api.connections.mysql.connector.connect")
    def test_unsaved_connection_rejects_disconnected_result(self, connect):
        connect.return_value = FakeConnection(connected=False)
        request = ConnectionInput(**self.valid_payload())

        with self.assertRaises(HTTPException) as context:
            check_unsaved_connection(request, {"sub": "1"})

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Unable to connect using these database details")


if __name__ == "__main__":
    unittest.main()
