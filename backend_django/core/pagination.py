"""Pagination classes for DRF."""

from rest_framework.pagination import PageNumberPagination, CursorPagination

# Hard ceiling — no client request can exceed this regardless of page_size param.
MAX_PAGE_SIZE = 100


class StandardPagination(PageNumberPagination):
    """Standard pagination class for API responses.

    Clients may request a custom page_size via the query parameter, but the
    value is clamped server-side to [1, MAX_PAGE_SIZE].  This prevents denial-
    of-service via page_size=999999 style abuse.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = MAX_PAGE_SIZE

    def get_page_size(self, request):
        """Clamp the requested page_size to [1, MAX_PAGE_SIZE]."""
        size = super().get_page_size(request)
        if size is None:
            return self.page_size
        # super() already applies max_page_size, but we enforce the floor too.
        return max(1, min(size, MAX_PAGE_SIZE))


class StandardCursorPagination(CursorPagination):
    """Cursor-based pagination for frequently updated sequential datasets.

    Uses opaque cursor tokens so that newly inserted rows do not cause records
    to be duplicated or skipped between pages — critical for real-time gate pass
    polling.  page_size is clamped to [1, MAX_PAGE_SIZE].

    DRF's built-in CursorPagination.get_ordering() hard-asserts that the
    ordering returned by filter backends is not None.  This trips when
    OrderingFilter is in DEFAULT_FILTER_BACKENDS but the view does not declare
    ordering_fields and the client sends no ordering query param.  We patch the
    ordering fields directly on the combined filter result before DRF validates.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = MAX_PAGE_SIZE
    ordering = '-created_at'

    def get_ordering(self, request, queryset, view):
        """Return ordering, patching in the class-level default when backends
        return None so the hard-assert in CursorPagination never fires."""
        # Temporarily inject our default ordering into the OrderingFilter
        # so super().get_ordering() finds a non-None value.
        from rest_framework.filters import OrderingFilter
        for backend in getattr(view, 'filter_backends', []):
            if isinstance(backend, type) and issubclass(backend, OrderingFilter):
                if not hasattr(view, 'ordering_fields') or view.ordering_fields is None:
                    view.ordering_fields = ['created_at', 'updated_at']
                if not hasattr(view, 'ordering') or view.ordering is None:
                    view.ordering = self.ordering
                break
        ordering = super().get_ordering(request, queryset, view)
        if not ordering:
            return (self.ordering,)
        return ordering

    def get_page_size(self, request):
        """Clamp the requested page_size to [1, MAX_PAGE_SIZE]."""
        size = super().get_page_size(request)
        if size is None:
            return self.page_size
        return max(1, min(size, MAX_PAGE_SIZE))
