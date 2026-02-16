# Email Mandatory for Password Reset (OTP Flow)

## Summary
Updated the user system to require **email for all users** to ensure the forgot password OTP flow works smoothly.

## Changes Made

### 1. User Model (`apps/auth/models.py`)
- Added email validation in the `clean()` method
- Email is now mandatory for all user types
- Validation triggers before user creation/update

### 2. User Creation Serializer (`apps/auth/serializers.py`)
- Made `email` field **required=True** during user registration
- Email validation at serializer level
- Provides clear error message if email is missing

## Affected Flows

### ✅ User Registration
- Email field is now required
- Registration will fail without valid email
- Error message: "This field is required."

### ✅ Forgot Password / OTP Reset
- OTP email delivery guaranteed (all users have email)
- Smooth password reset flow
- No missing email issues

### ✅ Admin User Creation
- When creating users via Django admin, email is required
- Validation enforces email entry

## How It Works

### User Registration Flow
```
1. User enters email (REQUIRED)
2. User enters other details
3. System validates email format and uniqueness
4. User created with email
5. OTP can be sent for password reset
```

### OTP Password Reset Flow
```
1. User requests password reset
2. System checks if user exists (by hall_ticket)
3. System sends OTP to user's EMAIL ✅
4. User receives OTP in email inbox
5. User verifies OTP and sets new password
```

## Error Handling

### Missing Email During Registration
```json
{
  "email": ["This field is required."]
}
```

### Empty Email
```json
{
  "email": ["Email is required for all users."]
}
```

### Invalid Email Format
```json
{
  "email": ["Enter a valid email address."]
}
```

## Database Impact

- No migration needed (email is already part of Django's AbstractUser)
- Existing users without email can still login
- New constraint applies only to **new user registrations**

## Existing Users Without Email

For existing users without email:

```bash
cd backend_django

# Via Django admin: Add email manually
# Via management command:
python3 manage.py shell
```

```python
from apps.auth.models import User

# Update a specific user
user = User.objects.get(username='21BJ1A5447')
user.email = 'student@domain.com'
user.save()

# Update all users without email (if needed)
users_without_email = User.objects.filter(email='')
for user in users_without_email:
    # Add email logic here
    pass
```

## Testing

### Test 1: Register New User with Email ✅
```bash
POST /api/auth/users/

{
  "hall_ticket": "21BJ1A5447",
  "email": "student@domain.com",  # REQUIRED
  "first_name": "John",
  "last_name": "Doe",
  "password": "SecurePassword123!",
  "password_confirm": "SecurePassword123!",
  ...
}
```

### Test 2: Register Without Email ❌
```bash
POST /api/auth/users/

{
  "hall_ticket": "21BJ1A5447",
  "first_name": "John",
  "last_name": "Doe",
  "password": "SecurePassword123!",
  ...
}

# Response:
{
  "email": ["This field is required."]
}
```

### Test 3: Forgot Password OTP ✅
```bash
1. Request OTP: POST /api/auth/otp-request/
   {"hall_ticket": "21BJ1A5447"}
   
2. OTP sent to user's email ✅
   
3. Verify OTP: POST /api/auth/otp-verify/
   {"hall_ticket": "21BJ1A5447", "otp": "123456", "new_password": "NewPass123!"}
```

## Admin Commands

### View users without email
```bash
python3 manage.py shell

from apps.auth.models import User
User.objects.filter(email='').count()
```

### Bulk update emails (CSV import example)
```bash
python3 manage.py shell

import csv
from apps.auth.models import User

with open('users_emails.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        user = User.objects.get(username=row['hall_ticket'])
        user.email = row['email']
        user.save()
```

## Deployment Checklist

- ✅ Code deployed
- ✅ Model changes applied
- ✅ Email validation active
- ✅ New users must provide email
- ⚠️ Existing users: Can still login but won't receive OTP emails
- 📝 Recommendation: Add email to existing users via admin panel

## Future Enhancements

- [ ] Email verification flow for new signups
- [ ] Bulk email updates for existing users
- [ ] Email update endpoint for users
- [ ] Email templates customization
- [ ] Multiple email addresses per user (optional)

---

**Status**: ✅ LIVE
**Date**: February 16, 2026
**Impact**: All new user registrations now require email
