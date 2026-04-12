import re

with open("apps/sports/models.py", "r") as f:
    content = f.read()

target = """    STATUS_CHOICES = [
        ('booked', 'Booked'),
        ('cancelled', 'Cancelled'),
    ]"""

new_choices = """    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]"""

content = content.replace(target, new_choices)

# Ensure default is pending:
target_status_field = "status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='booked')"
new_status_field = "status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')"

content = content.replace(target_status_field, new_status_field)

with open("apps/sports/models.py", "w") as f:
    f.write(content)

print("Sports models patched.")
