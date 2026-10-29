from unittest.mock import patch

import app.main
from app.api.ai import deterministic_review
from app.api.ai_service import AIService


SCHEMA = "employees(id int, name varchar(100), department varchar(50), salary decimal(10,2)); departments(id int, name varchar(50))"


def test_blank_optional_ai_environment_values_use_defaults():
    with patch.dict("os.environ", {"AI_PROVIDER": "", "AI_TIMEOUT_SECONDS": ""}):
        service = AIService()
    assert service.provider == "ollama"
    assert service.timeout == 60


def test_debug_detects_missing_table():
    review = deterministic_review("SELECT name FROM abc;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert any("does not exist" in issue["message"] and "`abc`" in issue["message"] for issue in review["issues"])


def test_debug_detects_missing_column():
    review = deterministic_review("SELECT imaginary FROM employees;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert any("Column `imaginary` does not exist" in issue["message"] for issue in review["issues"])


def test_debug_accepts_valid_query():
    review = deterministic_review("SELECT name FROM employees WHERE id = 1;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert review["issues"] == []


def test_debug_detects_unsafe_update():
    review = deterministic_review("UPDATE employees SET salary = 0;", "mysql", SCHEMA)
    assert any(issue["category"] == "safety" for issue in review["issues"])


def test_optimize_identifies_select_star_and_limit():
    review = deterministic_review("SELECT * FROM employees ORDER BY salary DESC;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert any("SELECT *" in suggestion for suggestion in review["optimizations"])
    assert any("LIMIT" in suggestion for suggestion in review["optimizations"])


def test_invalid_syntax_is_reported():
    review = deterministic_review("SELECT FROM", "mysql", SCHEMA)
    assert review["valid_syntax"] is False
    assert review["issues"][0]["category"] == "syntax"


def test_missing_semicolon_is_a_style_warning():
    review = deterministic_review("SELECT name FROM employees", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert review["issues"] == []
    assert any("semicolon" in warning for warning in review["style_warnings"])


def test_show_tables_is_valid_and_recognized():
    review = deterministic_review("SHOW TABLES;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert review["issues"] == []
    assert review["statement"]["query_type"] == "SHOW"
    assert "metadata" in review["operation_summary"].lower()


def test_describe_is_valid_and_recognized():
    review = deterministic_review("DESCRIBE employees;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert review["statement"]["query_type"] == "DESCRIBE"


def test_create_does_not_require_target_to_exist():
    review = deterministic_review("CREATE TABLE querypulse_new(id INT);", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert not any("does not exist" in issue["message"] for issue in review["issues"])


def test_filtered_update_has_operation_specific_optimization():
    review = deterministic_review("UPDATE employees SET salary = 1 WHERE id = 1;", "mysql", SCHEMA)
    assert review["valid_syntax"] is True
    assert any("filter columns" in suggestion for suggestion in review["optimizations"])
