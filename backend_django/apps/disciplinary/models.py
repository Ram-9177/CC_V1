"""Models for Disciplinary app."""
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class DisciplinaryAction(TimestampedModel):
    """Model for tracking disciplinary records and fines."""
    
    ACTION_TYPES = [
        ('late', 'Late Return'),
        ('damage', 'Property Damage'),
        ('noise', 'Noise/Indiscipline'),
        ('misconduct', 'Misconduct'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('severe', 'Severe'),
    ]
    
    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='disciplinary_actions', db_index=True,
    )
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='disciplinary_records')
    action_type = models.CharField(max_length=20, choices=ACTION_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='low')
    title = models.CharField(max_length=200)
    description = models.TextField()
    fine_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_paid = models.BooleanField(default=False)
    paid_date = models.DateTimeField(null=True, blank=True)
    action_taken_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='issued_disciplinary_actions')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'is_paid']),
            models.Index(fields=['action_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['student', '-created_at'], name='disc_student_created_idx'),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.action_type}"


class FineLedgerEntry(TimestampedModel):
    """Immutable ledger events for disciplinary fine lifecycle."""

    ENTRY_TYPES = [
        ('issued', 'Fine Issued'),
        ('adjustment', 'Fine Adjusted'),
        ('payment', 'Fine Paid'),
        ('reopened', 'Payment Reversed'),
    ]

    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='fine_ledger_entries', db_index=True,
    )
    disciplinary_action = models.ForeignKey(
        DisciplinaryAction,
        on_delete=models.CASCADE,
        related_name='ledger_entries',
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='fine_ledger_entries',
    )
    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fine_ledger_created',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', '-created_at'], name='fineledger_student_created_idx'),
            models.Index(fields=['disciplinary_action', '-created_at'], name='fineledger_action_created_idx'),
            models.Index(fields=['entry_type'], name='fineledger_entry_type_idx'),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.entry_type} - {self.amount}"
