from rest_framework import serializers
from .models import DisciplinaryAction, FineLedgerEntry
from apps.auth.serializers import UserSerializer


class FineLedgerEntrySerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = FineLedgerEntry
        fields = [
            'id',
            'entry_type',
            'amount',
            'balance_after',
            'notes',
            'created_by',
            'created_by_details',
            'created_at',
        ]
        read_only_fields = fields

class DisciplinaryActionSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)
    action_taken_by_details = UserSerializer(source='action_taken_by', read_only=True)
    ledger_entries = FineLedgerEntrySerializer(many=True, read_only=True)

    class Meta:
        model = DisciplinaryAction
        fields = [
            'id', 'student', 'student_details', 'action_type', 'severity',
            'title', 'description', 'fine_amount', 'is_paid', 'paid_date',
            'action_taken_by', 'action_taken_by_details', 'ledger_entries', 'created_at', 'updated_at'
        ]
        read_only_fields = ['action_taken_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['action_taken_by'] = self.context['request'].user
        return super().create(validated_data)
