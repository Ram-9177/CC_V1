import pytest
from requests import Session
from tests.utils import auth_headers, login_and_get_tokens

@pytest.mark.django_db(transaction=True)
@pytest.mark.api
def test_debug(requests_session: Session, live_api_base_url: str, user_factory):
    user_factory(
        username="STRICT_STUDENT",
        registration_number="STRICT_STUDENT",
        password="StudentPass123",
        role="student",
        is_password_changed=True,
    )
    tokens = login_and_get_tokens(
        requests_session,
        live_api_base_url,
        hall_ticket="STRICT_STUDENT",
        password="StudentPass123",
    )
    headers = auth_headers(tokens["access"])

    response = requests_session.post(
        f"{live_api_base_url}/complaints/",
        json={
            "category": "plumbing",
            "title": "Tap leaking",
            "description": "Tap in washroom is leaking.",
        },
        headers=headers,
        timeout=20,
    )

    print("\nXXX DEBUG OUTPUT", response.status_code, response.json())
