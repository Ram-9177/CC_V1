import pytest


@pytest.mark.skip("Playwright UI tests are disabled in this project.")
def test_ui_tests_disabled() -> None:
    """Placeholder test so Django's test runner finds this module cleanly."""
    assert True
