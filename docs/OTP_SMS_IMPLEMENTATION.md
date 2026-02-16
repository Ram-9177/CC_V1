# OTP Email Implementation Guide (100% FREE)

## Overview
The application uses **Email-based OTP** for password reset functionality. Users can reset their password by receiving an OTP via email on their registered email address. **Completely FREE - no external API costs!**

## How It Works

### OTP Request Flow
1. User enters their Hall Ticket/Username on the reset password page
2. Backend generates a 6-digit OTP and stores it securely in Redis cache (15-minute validity)
3. OTP is sent via email to the user's registered email address
4. User receives the OTP in their inbox
5. User enters the OTP and new password
6. Backend verifies the OTP and updates the password

### Security Features
- **OTP Hashing**: OTP is stored as SHA256 hash in Redis (not plain text)
- **Time Limit**: OTP expires after 15 minutes
- **Rate Limiting**: API requests are throttled to prevent brute force attacks
- **Secure Comparison**: OTP verification uses constant-time comparison
- **Username Enumeration Prevention**: Always returns success message even if account doesn't exist
- **Email Security**: Beautiful HTML-formatted email with clear security warnings

## Setup Instructions

### 1. Email Configuration (Already in your project)

Your project already has email configured in `.env`:
```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@hostelconnect.com
```

### 2. Development Testing
In development mode (DEBUG=True):
- Emails are printed to console
- You'll see the OTP in server logs
- Check Django logs: `PASSWORD RESET OTP for <username>: <otp>`

### 3. Production Deployment
For production, use your email provider:

#### **Option A: Gmail**
1. Enable 2-step verification on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the generated password in `.env`

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx  # 16-character app password
EMAIL_PORT=587
```

#### **Option B: SendGrid (Free tier - 100 emails/day)**
1. Sign up at https://sendgrid.com (free account)
2. Create API key
3. Update settings:

```env
EMAIL_BACKEND=sendgrid_backend.SendgridBackend
SENDGRID_API_KEY=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

#### **Option C: Mailgun (Free tier - up to 5,000 emails/month)**
1. Sign up at https://www.mailgun.com
2. Get credentials
3. Configure in Django

## API Endpoints

### Request OTP
**POST** `/api/auth/otp-request/`

Request:
```json
{
  "hall_ticket": "21BJ1A5447"
}
```

Response:
```json
{
  "message": "If account exists, OTP has been sent to registered email."
}
```

### Verify OTP & Reset Password
**POST** `/api/auth/otp-verify/`

Request:
```json
{
  "hall_ticket": "21BJ1A5447",
  "otp": "123456",
  "new_password": "NewSecurePassword123!"
}
```

Response:
```json
{
  "message": "Password reset successfully."
}
```

## User Profile Requirements
For Email OTP to work, users must have:
- A valid `email` field in their user account
- Access to their email inbox

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid OTP or expired" | OTP is wrong or 15 minutes have passed | Request a new OTP |
| "Hall ticket not found" | Invalid username | Check username/hall ticket |
| Email not received | Check email configuration | Verify EMAIL_HOST settings |
| Email in spam | Email provider filtering | Check spam/promotions folder |

## Testing in Development

1. Set `DEBUG=True` in `.env`
2. Request OTP - check Django logs for OTP code
3. Use the OTP from logs to test the reset flow
4. Monitor logs: `tail -f /tmp/django.log`

## Email Template
The OTP email includes:
- ✅ Professional HTML formatting
- ✅ Orange branded design (matching app theme)
- ✅ Clear OTP display
- ✅ Security warnings (15-min validity, don't share)
- ✅ Company footer

## Cost Comparison

| Method | Cost | Status |
|--------|------|--------|
| **Email (Current)** | **FREE** | ✅ Implemented |
| SMS (Twilio) | $0.0075/message | ❌ Not used |
| WhatsApp | $0.005/message | ❌ Not used |

## Production Checklist

- [ ] Configure email credentials in production `.env`
- [ ] Test OTP email delivery
- [ ] Verify email appears in user inbox (not spam)
- [ ] Test full password reset flow
- [ ] Monitor email delivery failures
- [ ] Set up email bounce handling

## Troubleshooting

### Email Not Sending
1. Check email configuration in `.env`
2. Verify EMAIL_HOST credentials
3. Check Django logs for send errors
4. Test with `python manage.py shell`:
```python
from django.core.mail import send_mail
send_mail('Test', 'Test body', 'from@example.com', ['to@example.com'])
```

### Email in Spam
1. Configure SPF/DKIM records (if using custom domain)
2. Use reputable email provider (SendGrid, Mailgun)
3. Add "Do not mark as spam" instructions in email template

### Low Delivery Rate
- Use SendGrid/Mailgun instead of Gmail (better deliverability)
- Configure proper email headers
- Monitor bounce rates

## Future Enhancements
- [ ] Email template customization
- [ ] Multi-language OTP emails
- [ ] SMS fallback (paid optional)
- [ ] WhatsApp integration (optional)
- [ ] Email delivery status tracking
- [ ] OTP resend limit enforcement

---

**Last Updated**: February 16, 2026
**Status**: Ready for Production (100% FREE)
**Cost**: $0 per month

