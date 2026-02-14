from __future__ import annotations

import os
import re
from datetime import datetime, timedelta

import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import Browser, Page, expect  # noqa: E402


DASHBOARD_HEADING = re.compile(
    r"^(Dashboard|My Dashboard|Warden Dashboard|Kitchen Dashboard|Gate Security|Campus Security Head)$"
)


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.getenv("BASE_URL", "http://localhost:5173").rstrip("/")


@pytest.fixture(scope="session")
def credentials() -> tuple[str, str]:
    hall_ticket = os.getenv("E2E_HALL_TICKET", "STUDENT1")
    password = os.getenv("E2E_PASSWORD", "password123")
    return hall_ticket, password


@pytest.fixture
def gate_pass_dates() -> tuple[str, str, str, str]:
    now = datetime.now()
    exit_dt = now + timedelta(days=1)
    return_dt = now + timedelta(days=2)
    return (
        exit_dt.strftime("%Y-%m-%d"),
        "10:00",
        return_dt.strftime("%Y-%m-%d"),
        "18:00",
    )


@pytest.mark.ui
@pytest.mark.e2e
def test_desktop_user_journey_login_dashboard_form_submit_logout(
    page: Page,
    base_url: str,
    credentials: tuple[str, str],
    gate_pass_dates: tuple[str, str, str, str],
) -> None:
    hall_ticket, password = credentials
    exit_date, exit_time, return_date, return_time = gate_pass_dates

    page.goto(f"{base_url}/login", wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name="Welcome to HostelConnect")).to_be_visible()

    page.locator("#hall_ticket").fill(hall_ticket)
    page.locator("#password").fill(password)
    page.get_by_role("button", name="Sign In").click()

    expect(page.get_by_text("Welcome back!").first).to_be_visible(timeout=15000)
    expect(page.get_by_role("heading", name=DASHBOARD_HEADING).first).to_be_visible(timeout=15000)

    page.get_by_role("link", name="Gate Passes").first.click()
    expect(page).to_have_url(re.compile(r".*/gate-passes/?$"))
    expect(page.get_by_role("heading", name="Gate Passes")).to_be_visible()

    page.get_by_role("button", name=re.compile(r"Create Gate Pass")).first.click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_role("heading", name="Request Gate Pass")).to_be_visible()

    dialog.locator("#purpose").fill("Family visit for personal emergency.")
    dialog.locator("#destination").fill("Hyderabad")
    dialog.locator("#exit_date").fill(exit_date)
    dialog.locator("#exit_time").fill(exit_time)
    dialog.locator("#return_date").fill(return_date)
    dialog.locator("#return_time").fill(return_time)
    dialog.locator("#remarks").fill("Returning before hostel curfew.")

    dialog.get_by_role("button", name=re.compile(r"Create Gate Pass")).click()
    expect(page.get_by_text("Gate pass created successfully").first).to_be_visible(timeout=15000)

    page.get_by_role("button", name="Logout").click()
    expect(page).to_have_url(re.compile(r".*/login/?$"))
    expect(page.get_by_role("heading", name="Welcome to HostelConnect")).to_be_visible()


@pytest.mark.ui
@pytest.mark.e2e
def test_mobile_login_validation_and_redirects(
    browser: Browser,
    base_url: str,
    credentials: tuple[str, str],
) -> None:
    hall_ticket, password = credentials

    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
            "Mobile/15E148 Safari/604.1"
        ),
    )

    page = context.new_page()
    try:
        page.goto(f"{base_url}/login", wait_until="domcontentloaded")
        expect(page.get_by_role("heading", name="Welcome to HostelConnect")).to_be_visible()

        page.locator("#hall_ticket").fill(" ")
        page.locator("#password").fill(" ")
        page.get_by_role("button", name="Sign In").click()

        expect(page.get_by_text("Hall ticket is required")).to_be_visible()
        expect(page.get_by_text("Password is required")).to_be_visible()

        page.locator("#hall_ticket").fill(hall_ticket)
        page.locator("#password").fill(password)
        page.get_by_role("button", name="Sign In").click()

        expect(page.get_by_text("Welcome back!").first).to_be_visible(timeout=15000)
        expect(page.get_by_role("heading", name=DASHBOARD_HEADING).first).to_be_visible(timeout=15000)

        page.get_by_role("button", name="Logout").click()
        expect(page).to_have_url(re.compile(r".*/login/?$"))
    finally:
        context.close()
