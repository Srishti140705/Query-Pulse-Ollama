from __future__ import annotations

from typing import Any, Dict, List, Optional


class QueryAnalyzer:
    """Analyze a parsed SQL query (output from SQLParser.parse) and
    return performance/complexity metrics, warnings, and recommendations.

    Expected input format (keys used):
      - query_type: str
      - tables: List[str]
      - columns: List[str]
      - where_conditions: List[str]
      - joins: List[str]
      - group_by: List[str]
      - order_by: List[str]
      - limit: Optional[str]
      - aliases: List[Dict[str,str]]

    The analyzer intentionally uses conservative heuristics and returns
    human-readable recommendations for common performance issues.
    """

    def __init__(self, parsed_query: Dict[str, Any]):
        if not isinstance(parsed_query, dict):
            raise ValueError("parsed_query must be a dictionary returned by SQLParser.parse()")
        self.parsed = parsed_query

    def analyze(self) -> Dict[str, Any]:
        score = 100
        warnings: List[str] = []
        recommendations: List[str] = []

        qtype = (self.parsed.get("query_type") or "").upper()
        columns = self._as_list(self.parsed.get("columns"))
        where = self._as_list(self.parsed.get("where_conditions"))
        joins = self._as_list(self.parsed.get("joins"))
        group_by = self._as_list(self.parsed.get("group_by"))
        order_by = self._as_list(self.parsed.get("order_by"))
        limit = self.parsed.get("limit")

        # Rule: Penalize SELECT * or table.* usage
        select_star_hits = [c for c in columns if self._is_select_all(c)]
        if select_star_hits:
            penalty = 25
            score -= penalty
            warnings.append("Use of SELECT * or table.* found")
            recommendations.append(
                "Avoid SELECT *; list only required columns to reduce I/O and enable index usage."
            )

        # Rule: Penalize missing LIMIT for SELECT queries
        if qtype == "SELECT":
            if limit is None:
                score -= 15
                warnings.append("Missing LIMIT clause on SELECT query")
                recommendations.append(
                    "Add a LIMIT when appropriate to avoid returning excessive rows, or paginate results."
                )

        # Rule: Penalize queries without WHERE for SELECT/UPDATE/DELETE
        if qtype in {"SELECT", "UPDATE", "DELETE"}:
            if not where:
                score -= 20
                warnings.append(f"No WHERE conditions for {qtype} statement")
                if qtype == "SELECT":
                    recommendations.append(
                        "Add filtering predicates (WHERE) to reduce scanned rows; consider indexes."
                    )
                else:
                    recommendations.append(
                        f"Add a restrictive WHERE clause to avoid affecting all rows for {qtype}."
                    )

        # Rule: Penalize many JOINs (>3)
        join_count = len(joins)
        if join_count > 3:
            extra = join_count - 3
            penalty = 10 * extra
            score -= penalty
            warnings.append(f"High number of JOINs: {join_count}")
            recommendations.append(
                "Review JOINs: minimize joins, push predicates early, or denormalize if justified."
            )

        # Rule: Penalize ORDER BY without LIMIT (can cause full sort)
        if order_by and limit is None and qtype == "SELECT":
            score -= 10
            warnings.append("ORDER BY used without LIMIT")
            recommendations.append(
                "ORDER BY without LIMIT may require sorting large result sets; add LIMIT or index the ordering columns."
            )

        # Rule: Penalize GROUP BY on many columns
        gb_count = len(group_by)
        if gb_count > 5:
            score -= 15
            warnings.append(f"GROUP BY on many columns ({gb_count})")
            recommendations.append(
                "Reduce GROUP BY columns or pre-aggregate data if possible to improve performance."
            )
        elif gb_count > 3:
            score -= 7
            warnings.append(f"GROUP BY on multiple columns ({gb_count})")
            recommendations.append(
                "Consider if all GROUP BY columns are necessary; evaluate grouping keys for cardinality."
            )

        # Reward selecting specific columns (no SELECT *)
        if columns and not select_star_hits:
            score += 10
            recommendations.append(
                "Selecting explicit columns is good; maintain minimal column lists to reduce payload."
            )

        # Additional small heuristics / bonuses
        if join_count == 0 and where:
            score += 5
        if 0 < len(columns) <= 6 and not select_star_hits:
            score += 3

        # Clamp score
        score = max(0, min(100, score))

        complexity = self._classify_complexity(score, join_count, gb_count)
        estimated_cost = self._estimate_cost(score, join_count, gb_count)

        # Deduplicate warnings and recommendations while preserving order
        warnings = self._unique_preserve_order(warnings)
        recommendations = self._unique_preserve_order(recommendations)

        return {
            "performance_score": int(score),
            "complexity": complexity,
            "warnings": warnings,
            "recommendations": recommendations,
            "estimated_cost": estimated_cost,
        }

    def _is_select_all(self, column: str) -> bool:
        if not column or not isinstance(column, str):
            return False
        c = column.strip()
        # common patterns: '*', 'table.*', 'schema.table.*', 'alias.*'
        return c == "*" or c.endswith(".*") or c.upper() == "SELECT *"

    def _as_list(self, value: Optional[Any]) -> List[Any]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]

    def _unique_preserve_order(self, items: List[str]) -> List[str]:
        seen = set()
        out: List[str] = []
        for it in items:
            if it not in seen:
                seen.add(it)
                out.append(it)
        return out

    def _classify_complexity(self, score: int, join_count: int, group_by_count: int) -> str:
        # Complexity tiers based on score and structural factors
        if score < 40 or join_count > 6 or group_by_count > 8:
            return "High"
        if score < 70 or join_count > 3 or group_by_count > 4:
            return "Medium"
        return "Low"

    def _estimate_cost(self, score: int, join_count: int, group_by_count: int) -> str:
        # Rough cost estimation mapping
        if score < 40 or join_count > 4 or group_by_count > 6:
            return "High"
        if score < 70 or join_count > 2 or group_by_count > 3:
            return "Medium"
        return "Low"
