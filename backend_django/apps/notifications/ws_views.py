"""Optional HTTP helper to exercise the broadcast WebSocket group (DEBUG only)."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.http import JsonResponse


def test_ws(request):
    if not settings.DEBUG:
        return JsonResponse({'detail': 'Not found.'}, status=404)

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        'notifications',
        {
            'type': 'send_notification',
            'message': 'Hello from Django!',
        },
    )
    return JsonResponse({'status': 'sent'})
