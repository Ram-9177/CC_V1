from django.http import JsonResponse
from django.db import connections
from django.conf import settings
from django.views.decorators.http import require_GET

try:
    from django_redis import get_redis_connection
except Exception:
    get_redis_connection = None


@require_GET
def healthz(request):
    return JsonResponse({'status': 'ok', 'service': 'hostelconnect'})


@require_GET
def ping_db(request):
    try:
        conn = connections['default']
        with conn.cursor() as cur:
            cur.execute('SELECT 1')
            cur.fetchone()
        return JsonResponse({'db': 'ok'})
    except Exception as e:
        return JsonResponse({'db': 'error', 'error': str(e)}, status=500)


@require_GET
def ping_redis(request):
    if not get_redis_connection:
        return JsonResponse({'redis': 'unavailable'}, status=503)
    try:
        r = get_redis_connection('default')
        r.ping()
        return JsonResponse({'redis': 'ok'})
    except Exception as e:
        return JsonResponse({'redis': 'error', 'error': str(e)}, status=500)
