import os
import django
import sys
import argparse

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()

def main():
    parser = argparse.ArgumentParser(description="Manage Student HR Permissions")
    parser.add_argument('hall_ticket', help="Hall ticket/Registration number of the student")
    parser.add_argument('--remove', action='store_true', help="Remove the Student HR permission instead of adding")
    
    args = parser.parse_args()
    
    hall_ticket = args.hall_ticket.strip().upper()
    
    try:
        user = User.objects.get(username__iexact=hall_ticket)
    except User.DoesNotExist:
        try:
            user = User.objects.get(registration_number__iexact=hall_ticket)
        except User.DoesNotExist:
            print(f"Error: User with hall ticket '{hall_ticket}' not found.")
            return

    group, created = Group.objects.get_or_create(name='Student_HR')
    if created:
        print("Created group: Student_HR")

    if args.remove:
        if group in user.groups.all():
            user.groups.remove(group)
            print(f"Removed Student HR permission from {user.username}.")
        else:
            print(f"{user.username} is not a Student HR.")
    else:
        if group not in user.groups.all():
            user.groups.add(group)
            print(f"Granted Student HR permission to {user.username}.")
        else:
            print(f"{user.username} is already a Student HR.")

if __name__ == '__main__':
    main()
