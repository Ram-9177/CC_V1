"""Analytics app serializers — Phase 10."""
from rest_framework import serializers
from .models import DailyHostelMetrics, DashboardSummary, GatePassListView, ComplaintSummary

class DailyHostelMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyHostelMetrics
        fields = '__all__'

class DashboardSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardSummary
        fields = '__all__'

class GatePassListViewSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatePassListView
        fields = '__all__'

class ComplaintSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintSummary
        fields = '__all__'
