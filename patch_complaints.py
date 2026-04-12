import re

with open("apps/complaints/models.py", "r") as f:
    content = f.read()

target = """    STATUS_CHOICES = [
        ('open', 'Open'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
        ('reopened', 'Reopened'),
        ('invalid', 'Invalid/Fake'),
    ]"""

new_choices = """    STATUS_CHOICES = [
        ('open', 'Open'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('procurement', 'Procurement'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
        ('reopened', 'Reopened'),
        ('invalid', 'Invalid/Fake'),
    ]"""

content = content.replace(target, new_choices)

with open("apps/complaints/models.py", "w") as f:
    f.write(content)

print("Complaints models patched.")
