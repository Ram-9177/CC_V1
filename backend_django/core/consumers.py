import json

from channels.generic.websocket import AsyncWebsocketConsumer


class BasicWebSocketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self.send(text_data=json.dumps({'message': 'connected'}))

    async def disconnect(self, close_code):
        return

    async def receive(self, text_data):
        payload = text_data or ''
        await self.send(text_data=json.dumps({'message': payload}))
