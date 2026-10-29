from __future__ import annotations

from typing import Any, Dict, List, Optional

import sqlglot
from sqlglot import exp


class SQLParser:
    """Parse SQL statements and extract common query components."""

    def __init__(self) -> None:
        self._expression: Optional[exp.Expression] = None
        self._query: Optional[str] = None

    def parse(self, query: str, dialect: Optional[str] = None) -> Dict[str, Any]:
        """Parse a SQL query and return extracted information."""
        if not isinstance(query, str) or not query.strip():
            raise ValueError("A non-empty SQL query string is required.")

        self._query = query.strip()
        dialect_name = {"postgresql": "postgres", "mariadb": "mysql"}.get(dialect or "", dialect)
        statements = [item for item in sqlglot.parse(self._query, read=dialect_name) if item is not None]
        if len(statements) != 1:
            raise ValueError("Enter exactly one SQL statement at a time.")
        self._expression = statements[0]

        return {
            "query_type": self.get_query_type(),
            "tables": self.get_tables(),
            "columns": self.get_columns(),
            "where_conditions": self.get_where_conditions(),
            "joins": self.get_joins(),
            "group_by": self.get_group_by(),
            "order_by": self.get_order_by(),
            "limit": self.get_limit(),
            "aliases": self.get_aliases(),
        }

    def get_query_type(self) -> str:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        return self._expression.key.upper()

    def get_tables(self) -> List[str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        tables = []

        for table in self._expression.find_all(exp.Table):
            tables.append(table.name)

        return list(dict.fromkeys(tables))

    def get_columns(self) -> List[str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        columns = ["*"] if any(isinstance(item, exp.Star) and isinstance(item.parent, exp.Select) for item in self._expression.find_all(exp.Star)) else []

        for column in self._expression.find_all(exp.Column):
            columns.append(column.sql())

        return list(dict.fromkeys(columns))

    def get_where_conditions(self) -> List[str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        where = self._expression.find(exp.Where)

        if where is None:
            return []

        return [where.this.sql()]

    def get_joins(self) -> List[str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        joins = []

        for join in self._expression.find_all(exp.Join):
            joins.append(join.sql())

        return joins

    def get_group_by(self) -> List[str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        group = self._expression.find(exp.Group)

        if group is None:
            return []

        return [expr.sql() for expr in group.expressions]

    def get_order_by(self) -> List[str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        order = self._expression.find(exp.Order)

        if order is None:
            return []

        return [expr.sql() for expr in order.expressions]

    def get_limit(self) -> Optional[int]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        limit = self._expression.find(exp.Limit)

        if limit is None:
            return None

        try:
            return int(limit.expression.this)
        except Exception:
            return None

    def get_aliases(self) -> Dict[str, str]:
        if self._expression is None:
            raise ValueError("No SQL query has been parsed yet.")

        aliases = {}

        for table in self._expression.find_all(exp.Table):
            if table.alias:
                aliases[table.alias] = table.name

        return aliases