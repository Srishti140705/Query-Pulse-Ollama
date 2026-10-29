import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.api.parser import SQLParser

class SqlParserTests(unittest.TestCase):
    def test_parses_select_query(self):
        result = SQLParser().parse("SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS full_name FROM users AS u JOIN orders AS o ON u.id = o.user_id WHERE u.active = TRUE GROUP BY u.id ORDER BY u.id DESC LIMIT 10")
        self.assertEqual(result['query_type'], 'SELECT')
        self.assertEqual(result['tables'], ['users', 'orders'])
        self.assertIn('u.id', result['columns'])
        self.assertIn('u.active = TRUE', result['where_conditions'])
        self.assertTrue(any('orders' in join for join in result['joins']))
        self.assertEqual(result['group_by'], ['u.id'])
        self.assertEqual(result['order_by'], ['u.id DESC'])
        self.assertEqual(result['limit'], 10)
        self.assertEqual(result['aliases']['u'], 'users')

    def test_dialects_and_multiple_statements(self):
        for dialect in ['mysql', 'mariadb', 'sqlite', 'postgresql']:
            self.assertEqual(SQLParser().parse('SELECT id FROM employees LIMIT 1', dialect)['tables'], ['employees'])
        for query in ['', '-- comment only', 'SELECT 1; SELECT 2']:
            with self.assertRaises(ValueError):
                SQLParser().parse(query)

if __name__ == '__main__':
    unittest.main()
