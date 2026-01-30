"""Pagination classes for DRF."""

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Standard pagination class for API responses."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
