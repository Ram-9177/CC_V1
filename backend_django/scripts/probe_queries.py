"""
Local DB probe – called by measure_local.sh
Prints query counts and timings for key endpoints.
"""
import os, sys, time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')

import django
django.setup()

from django.db import connection, reset_queries

probes = []

# Health ping
probes.append((
    'Health check (SELECT 1)',
    lambda: connection.cursor().execute('SELECT 1'),
))

# Notices – optimised
try:
    from apps.notices.models import Notice
    probes.append((
        'Notices list (optimised – select_related)',
        lambda: list(
            Notice.objects
            .select_related('author', 'target_building')
            .filter(is_published=True)
            .order_by('-published_date')[:20]
        ),
    ))
    probes.append((
        'Notices list (OLD – no select_related)',
        lambda: list(
            Notice.objects
            .filter(is_published=True)
            .order_by('-published_date')[:20]
        ),
    ))
except Exception:
    pass

# Rooms
try:
    from apps.rooms.models import Room
    probes.append((
        'Rooms list (select_related building)',
        lambda: list(Room.objects.select_related('building')[:20]),
    ))
except Exception:
    pass

# DB connections
from django.conf import settings
try:
    if 'sqlite3' in settings.DATABASES['default']['ENGINE']:
        print("DB Connections: SQLite (1 file-lock – local only)")
    else:
        with connection.cursor() as c:
            c.execute("""
                SELECT count(*) FROM pg_stat_activity
                WHERE datname = current_database() AND state != 'idle'
            """)
            count = c.fetchone()[0]
        print(f"DB Connections: {count}")
except Exception as e:
    print(f"DB Connections: error – {e}")

print("")
print("Query probe results:")

connection.force_debug_cursor = True
for label, fn in probes:
    reset_queries()
    t0 = time.perf_counter()
    try:
        fn()
        elapsed_ms = (time.perf_counter() - t0) * 1000
        q = len(connection.queries)
        flag = 'OK  ' if q <= 3 else ('WARN' if q <= 8 else 'SLOW')
        print(f"  [{flag}] {label}: {q} queries / {elapsed_ms:.1f}ms")
    except Exception as exc:
        print(f"  [ERR ] {label}: {exc}")

connection.force_debug_cursor = False
