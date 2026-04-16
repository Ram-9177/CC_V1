#!/usr/bin/env python3
"""Idempotent patch helper for gate pass search filtering.

This script inserts the "Master Search" query block into
`backend_django/apps/gate_passes/views.py` right after the existing
`hall_ticket` search block.

If the block already exists, it exits without changes.
"""

from pathlib import Path

TARGET_FILE = Path("backend_django/apps/gate_passes/views.py")

ANCHOR = """        # Search with validation
        search_ticket = self.request.query_params.get('hall_ticket', '').strip()
        if search_ticket:
            # Sanitize input
            try:
                search_ticket = InputValidator.validate_string(search_ticket, \"hall_ticket\", 50)
                queryset = queryset.filter(student__registration_number__icontains=search_ticket)
            except Exception as e:
                logger.warning(f\"Invalid search ticket: {str(e)}\")
"""

MASTER_SEARCH_BLOCK = """

        # Master Search (Phase 3 Requirement)
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            try:
                sq = InputValidator.validate_string(search_query, \"search\", 50)
                if sq.isdigit():
                    queryset = queryset.filter(id=int(sq))
                else:
                    sq_parts = sq.split()
                    if len(sq_parts) > 1:
                        queryset = queryset.filter(
                            Q(student__registration_number__icontains=sq) |
                            Q(student__first_name__icontains=sq_parts[0], student__last_name__icontains=sq_parts[1])
                        )
                    else:
                        queryset = queryset.filter(
                            Q(student__registration_number__icontains=sq) |
                            Q(student__first_name__icontains=sq) |
                            Q(student__last_name__icontains=sq)
                        )
            except Exception as e:
                logger.warning(f\"Invalid master search query: {str(e)}\")
"""


def main() -> int:
    if not TARGET_FILE.exists():
        print(f"Target file not found: {TARGET_FILE}")
        return 1

    content = TARGET_FILE.read_text(encoding="utf-8")

    if "search_query = self.request.query_params.get('search', '').strip()" in content:
        print("Master search block already present. No changes made.")
        return 0

    if ANCHOR not in content:
        print("Anchor block not found. No changes made.")
        return 1

    updated = content.replace(ANCHOR, ANCHOR + MASTER_SEARCH_BLOCK, 1)
    TARGET_FILE.write_text(updated, encoding="utf-8")
    print("Patched views.py with master search block.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
