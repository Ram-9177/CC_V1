"""
Read-only audit hints for multi-tenant ViewSet coverage.

Does not modify data. Review output before adding queryset filters.
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Print tenant-scoping review checklist (read-only)."

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.NOTICE(
                "Tenant scoping audit (manual review)\n"
                "=====================================\n"
                "1. Prefer CollegeScopeMixin on ViewSets backed by TenantModel / college FK.\n"
                "2. Platform endpoints (CollegeViewSet writes, TenantViewSet, HealthCheckViewSet) "
                "may intentionally skip mixin — verify permissions.\n"
                "3. metrics.MetricViewSet uses a global queryset; tenant_id on Metric may be "
                "sparsely populated — do not filter by tenant without a backfill plan.\n"
                "4. Grep for: class *ViewSet(*ModelViewSet) without CollegeScopeMixin.\n"
                "5. Grep queryset = *.objects.all() under apps/ and confirm role + mixin coverage.\n"
            )
        )
