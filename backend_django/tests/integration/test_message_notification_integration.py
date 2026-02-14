from __future__ import annotations

from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.messages.models import Message
from apps.notifications.models import Notification


@pytest.mark.django_db
@pytest.mark.integration
class TestMessageNotificationIntegration:
    def test_message_create_triggers_notification_and_broadcast(self, user_factory):
        student = user_factory(username="MSG_STUDENT", role="student")
        warden = user_factory(username="MSG_WARDEN", role="warden")

        client = APIClient()
        client.force_authenticate(user=student)

        with patch("apps.messages.views.broadcast_to_updates_user") as mock_broadcast:
            response = client.post(
                "/api/messages/messages/",
                {
                    "recipient": warden.id,
                    "subject": "Need approval",
                    "body": "Please approve my request.",
                },
                format="json",
            )

        assert response.status_code == status.HTTP_201_CREATED
        assert Message.objects.filter(sender=student, recipient=warden).exists()

        notification = Notification.objects.filter(recipient=warden).order_by("-created_at").first()
        assert notification is not None
        assert "New message from" in notification.title
        assert notification.action_url == "/messages"

        mock_broadcast.assert_called_once_with(warden.id, "messages_updated", {"resource": "messages"})

    def test_only_recipient_can_mark_message_read(self, user_factory, message_factory):
        warden = user_factory(username="MARKREAD_WARDEN", role="warden")
        student = user_factory(username="MARKREAD_STUDENT", role="student")
        outsider = user_factory(username="MARKREAD_STAFF", role="staff")

        message = message_factory(sender=warden, recipient=student)

        client = APIClient()

        client.force_authenticate(user=outsider)
        forbidden = client.post(f"/api/messages/messages/{message.id}/mark_read/")
        assert forbidden.status_code in {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}

        client.force_authenticate(user=student)
        allowed = client.post(f"/api/messages/messages/{message.id}/mark_read/")
        assert allowed.status_code == status.HTTP_200_OK

        message.refresh_from_db()
        assert message.is_read is True
        assert message.read_at is not None
