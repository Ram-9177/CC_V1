"""
Management command: list_slow_queries
──────────────────────────────────────────────────────────────────────────────
Runs EXPLAIN ANALYZE on every user-defined table's most recent SELECT,
or accepts a raw SQL snippet to profile.

Usage:
    # Profile N queries against the live DB and print execution plans
    python manage.py list_slow_queries

    # Profile a specific query snippet
    python manage.py list_slow_queries --sql "SELECT id, status, created_at FROM gate_passes_gatepass"

    # Change threshold (default 300 ms) and top-N (default 10)
    python manage.py list_slow_queries --threshold 500 --top 20

All output goes to stdout – safe to pipe to a file for offline analysis.
Rollback: just stop calling this command; it makes no DB changes.
"""

from django.core.management.base import BaseCommand
from django.db import connection
import time


PROBE_QUERIES = [
    # (label, SQL)
    ('Room Mapping', 'SELECT r.id, r.room_number, r.floor, b.name FROM rooms_room r JOIN rooms_building b ON b.id = r.building_id ORDER BY r.id LIMIT 50'),
    ('Active Room Allocations', 'SELECT a.id, a.student_id, a.room_id, u.username FROM rooms_roomallocation a JOIN hostelconnect_auth_user u ON u.id = a.student_id WHERE a.end_date IS NULL AND a.status = \'approved\' LIMIT 50'),
    ('Gate Passes (recent)', 'SELECT id, student_id, status, created_at FROM gate_passes_gatepass ORDER BY created_at DESC LIMIT 50'),
    ('Notices (published)', 'SELECT id, title, priority, published_date FROM notices_notice WHERE is_published = TRUE ORDER BY published_date DESC LIMIT 50'),
    ('Users', 'SELECT id, username, role FROM hostelconnect_auth_user LIMIT 50'),
]


class Command(BaseCommand):
    help = (
        'Profile key DB queries and highlight slow ones. '
        'Runs EXPLAIN ANALYZE without changing data.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--threshold',
            type=float,
            default=300.0,
            help='Milliseconds above which a query is flagged as slow (default: 300)',
        )
        parser.add_argument(
            '--top',
            type=int,
            default=10,
            help='Maximum number of queries to profile (default: 10)',
        )
        parser.add_argument(
            '--sql',
            type=str,
            default=None,
            help='A specific SQL statement to profile (runs EXPLAIN ANALYZE on it)',
        )
        parser.add_argument(
            '--no-explain',
            action='store_true',
            dest='no_explain',
            help='When set, measure wall-clock time only without EXPLAIN ANALYZE',
        )

    def handle(self, *args, **options):
        threshold = options['threshold']
        top = options['top']
        custom_sql = options['sql']
        no_explain = options['no_explain']

        self.stdout.write(self.style.SUCCESS(
            '\n╔══════════════════════════════════════════════════════════════╗\n'
            '║          Django Slow Query Profiler                          ║\n'
            '╚══════════════════════════════════════════════════════════════╝'
        ))
        self.stdout.write(f'  Threshold : {threshold} ms')
        self.stdout.write(f'  Explain   : {"off" if no_explain else "on (EXPLAIN ANALYZE)"}')
        self.stdout.write(f'  Top N     : {top}\n')

        if custom_sql:
            queries_to_probe = [('Custom Query', custom_sql)]
        else:
            queries_to_probe = PROBE_QUERIES[:top]

        results = []

        with connection.cursor() as cursor:
            for label, sql in queries_to_probe:
                # ── Measure wall clock time of the raw query ──────────────────
                t0 = time.perf_counter()
                try:
                    cursor.execute(sql)
                    cursor.fetchall()
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                except Exception as exc:
                    self.stdout.write(
                        self.style.ERROR(f'  ✖  {label}: error – {exc}')
                    )
                    continue

                results.append((elapsed_ms, label, sql))

                flag = '❌ SLOW' if elapsed_ms >= threshold else '✅ OK'
                color = self.style.ERROR if elapsed_ms >= threshold else self.style.SUCCESS
                self.stdout.write(color(f'  {flag}  {label}: {elapsed_ms:.1f} ms'))

                # ── Optional EXPLAIN ANALYZE ───────────────────────────────────
                if not no_explain and elapsed_ms >= threshold:
                    self.stdout.write('')
                    self.stdout.write('  ─── EXPLAIN ANALYZE ───')
                    try:
                        cursor.execute(f'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) {sql}')
                        for row in cursor.fetchall():
                            self.stdout.write(f'      {row[0]}')
                    except Exception as explain_exc:
                        self.stdout.write(
                            self.style.WARNING(f'      (EXPLAIN failed: {explain_exc})')
                        )
                    self.stdout.write('')

        # ── Summary ────────────────────────────────────────────────────────────
        slow = [(ms, lbl) for ms, lbl, _ in results if ms >= threshold]
        self.stdout.write('\n' + '═' * 66)
        self.stdout.write(f'  Probed {len(results)} queries  |  Slow: {len(slow)}')
        if slow:
            self.stdout.write(self.style.ERROR('\n  Slow queries:'))
            for ms, lbl in sorted(slow, reverse=True):
                self.stdout.write(self.style.ERROR(f'    • {lbl}: {ms:.1f} ms'))
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                '  Next steps:\n'
                '    1. Run with --no-explain to get raw timings only\n'
                '    2. Add DB indexes on frequently filtered columns\n'
                '    3. Use select_related / prefetch_related to flatten N+1 queries\n'
                '    4. Consider Redis caching for read-heavy endpoints'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\n  ✅  All queries within {threshold} ms threshold. System healthy.'
            ))
        self.stdout.write('')
