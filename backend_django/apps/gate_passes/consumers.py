"""WebSocket consumer for gate pass workflow updates."""

import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser


class GatePassConsumer(AsyncWebsocketConsumer):
    """Streams new requests, status changes, and gate scan updates by role."""

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())
        if not self.user.is_authenticated:
            await self.accept()
            await self.close(code=4001)
            return

        self.groups_to_join = []
        role = getattr(self.user, 'role', None)

        if role in {'gate_security', 'security_head'}:
            self.groups_to_join.append('gatepass_security')
        if role in {'head_warden', 'warden', 'incharge', 'staff'}:
            self.groups_to_join.append('gatepass_warden')
        if role == 'student':
            self.groups_to_join.append(f'gatepass_student_{self.user.id}')

        if not self.groups_to_join:
            await self.accept()
            await self.close(code=4003)
            return

        for group in self.groups_to_join:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        for group in getattr(self, 'groups_to_join', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def new_gatepass(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_request',
            'gatepass_id': event.get('gatepass_id'),
            'student_name': event.get('student_name'),
            'student_room': event.get('student_room'),
            'pass_type': event.get('pass_type'),
            'reason': event.get('reason'),
            'scheduled_exit': event.get('scheduled_exit'),
            'timestamp': event.get('timestamp'),
        }))

    async def status_changed(self, event):
        payload = {
            'type': 'status_update',
            'gatepass_id': event.get('gatepass_id'),
            'status': event.get('status'),
            'approved_by': event.get('approved_by'),
            'remarks': event.get('remarks'),
            'timestamp': event.get('timestamp'),
        }

        # Student channels consume status_update payload.
        if str(event.get('target', '')).startswith('student'):
            await self.send(text_data=json.dumps(payload))
            return

        # Security channels receive approved_pass payload for gate queue updates.
        if event.get('status') == 'approved':
            security_payload = {
                'type': 'approved_pass',
                'gatepass_id': event.get('gatepass_id'),
                'student_name': event.get('student_name'),
                'status': event.get('status'),
                'valid_until': event.get('valid_until'),
            }
            await self.send(text_data=json.dumps(security_payload))
        else:
            await self.send(text_data=json.dumps(payload))

    async def gate_scan(self, event):
        await self.send(text_data=json.dumps({
            'type': 'gate_scan',
            'student_name': event.get('student_name'),
            'direction': event.get('direction'),
            'scan_time': event.get('scan_time'),
            'location': event.get('location'),
        }))
