import pytest
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model


User = get_user_model()


@pytest.mark.django_db
class TestMessagesPermissions(APITestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username='student_msg',
            email='student_msg@example.com',
            password='student123',
            registration_number='STU_MSG_001',
            role='student',
        )
        self.warden = User.objects.create_user(
            username='warden_msg',
            email='warden_msg@example.com',
            password='warden123',
            registration_number='WAR_MSG_001',
            role='warden',
        )
        self.head_warden = User.objects.create_user(
            username='headwarden_msg',
            email='headwarden_msg@example.com',
            password='headwarden123',
            registration_number='HWAR_MSG_001',
            role='head_warden',
        )
        self.staff = User.objects.create_user(
            username='staff_msg',
            email='staff_msg@example.com',
            password='staff123',
            registration_number='STF_MSG_001',
            role='staff',
        )

    def test_student_can_message_warden(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            '/api/messages/messages/',
            {'recipient': self.warden.id, 'subject': 'Help', 'body': 'Need assistance'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_student_cannot_message_staff(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            '/api/messages/messages/',
            {'recipient': self.staff.id, 'subject': 'Hi', 'body': 'Hello'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_warden_cannot_message_student(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            '/api/messages/messages/',
            {'recipient': self.student.id, 'subject': 'Notice', 'body': 'Do this'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_warden_can_message_student(self):
        self.client.force_authenticate(user=self.warden)
        response = self.client.post(
            '/api/messages/messages/',
            {'recipient': self.student.id, 'subject': 'Reply', 'body': 'OK'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

