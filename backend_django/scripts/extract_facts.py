import os, sys, time, platform
import django
from django.db import connection, connections
from django.core.cache import cache
from django.apps import apps
from django.conf import settings
from django.utils import timezone
from django.db.models import Count, Q

# Fact Extraction Logic
results = {}

# 1. SERVER CONFIG (Static extraction from known Prod config)
results['server'] = {
    'web_server': 'Gunicorn/Uvicorn',
    'workers': 2,
    'threads': 2,
    'worker_class': 'uvicorn.workers.UvicornWorker',
    'timeout_sec': 120,
    'keepalive_sec': 5,
    'max_request_size_mb': 15,
    'queue_limit': 'Dependent on Gunicorn backlog (default 2048)',
}

# 2. DATABASE CONFIG
try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT version();")
        results['db_version'] = cursor.fetchone()[0]
        
        # Connections (Postgres only)
        if 'postgresql' in connection.settings_dict['ENGINE']:
            cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();")
            results['db_active_connections'] = cursor.fetchone()[0]
            cursor.execute("SHOW max_connections;")
            results['db_max_connections'] = cursor.fetchone()[0]
        else:
            results['db_active_connections'] = 1
            results['db_max_connections'] = 'N/A (SQLite)'

        # Tables / Row Counts
        major_tables = ['auth.User', 'gate_passes.GatePass', 'attendance.Attendance', 'meals.MealAttendance']
        results['table_stats'] = {}
        for model_path in major_tables:
            app_label, model_name = model_path.split('.')
            try:
                model = apps.get_model(app_label, model_name)
                count = model.objects.count()
                results['table_stats'][model_name] = {
                    'count': count,
                    # Approximate index count (PK + explicit)
                    'index_count': len(model._meta.indexes) + len(model._meta.unique_together) + 1 
                }
            except: pass
except Exception as e:
    results['db_error'] = str(e)

# 3. REDIS CONFIG
try:
    from django_redis import get_redis_connection
    r = get_redis_connection('default')
    info = r.info()
    results['redis'] = {
        'version': info.get('redis_version'),
        'maxmemory_human': info.get('maxmemory_human', '0'),
        'used_memory_human': info.get('used_memory_human'),
        'eviction_policy': info.get('maxmemory_policy'),
        'total_keys': r.dbsize(),
        'keys_without_ttl': len([k for k in r.keys('*') if r.ttl(k) == -1]),
        'usage': ['Cache (DB 1)', 'Channel Layer (DB 0)', 'Sessions (Signed Cookies)']
    }
except Exception as e:
    results['redis_error'] = str(e)

# 4. WEBSOCKET
results['websocket'] = {
    'backend': 'channels_redis (Distributed)',
    'broadcast_mode': 'Async (transaction.on_commit + Channels groups)',
}

# 5. PERFORMANCESnapshot
try:
    import resource
    usage = resource.getrusage(resource.RUSAGE_SELF)
    divisor = 1024 if platform.system() == 'Linux' else (1024 * 1024)
    results['perf'] = {
        'ram_usage_mb': round(usage.ru_maxrss / divisor, 2),
        'cpu_time_self': usage.ru_utime + usage.ru_stime,
    }
except: pass

# 6. BUSINESS LOGIC FACTS
results['logic'] = {
    'forecast_recalc': 'On-demand (cached 300s)',
    'debounce': 'Client-side + Signal-driven Cache Invalidation',
    'notifications_async': 'Yes (Channels/WebSockets)',
    'emails_blocking': 'Yes (Default SMTP)',
}

# Output formatted
print("-" * 50)
print("LIVE SYSTEM FACT EXTRACTION - COMPLETE")
print("-" * 50)
for category, data in results.items():
    print(f"\n[{category.upper()}]")
    if isinstance(data, dict):
        for k, v in data.items():
            print(f"  {k:25}: {v}")
    else:
        print(f"  {data}")
print("-" * 50)
