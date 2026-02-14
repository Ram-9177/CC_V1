#!/bin/bash

# 🚀 HostelConnect - One-Click Setup Script
# Initializes backend, database, and gets everything ready

set -e

PROJECT_ROOT="/Users/ram/Desktop/SMG-Hostel"
BACKEND_DIR="$PROJECT_ROOT/backend_django"

echo "🔧 HostelConnect Setup Script"
echo "=============================="
echo ""

# Step 1: Check Python
echo "1️⃣  Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Install it first:"
    echo "   brew install python@3.11"
    exit 1
fi
echo "✅ Python found: $(python3 --version)"
echo ""

# Step 2: Install requirements
echo "2️⃣  Installing Python dependencies..."
cd "$BACKEND_DIR"
pip install -q -r requirements.txt 2>/dev/null || pip install -r requirements.txt | tail -5
echo "✅ Dependencies installed"
echo ""

# Step 3: Run migrations
echo "3️⃣  Running database migrations..."
python3 manage.py migrate --quiet || python3 manage.py migrate
echo "✅ Database initialized"
echo ""

# Step 4: Check for test user
echo "4️⃣  Checking test user..."
TEST_USER_COUNT=$(python3 -c "from apps.auth.models import User; print(User.objects.filter(username='testuser').count())" 2>/dev/null || echo "0")

if [ "$TEST_USER_COUNT" -eq 0 ]; then
    echo "   Creating test user..."
    python3 manage.py shell << EOF
from apps.auth.models import User
from django.contrib.auth.models import Group

# Create user
user = User.objects.create_user(
    username='testuser',
    password='testpass123',
    email='test@example.com',
    first_name='Test',
    last_name='User'
)

# Add to Student group
group, _ = Group.objects.get_or_create(name='Student')
user.groups.add(group)
user.role = 'student'
user.save()

print("✅ Test user created!")
print("   Username: testuser")
print("   Password: testpass123")
EOF
else
    echo "✅ Test user already exists"
fi
echo ""

# Step 5: Check .env
echo "5️⃣  Checking .env configuration..."
if grep -q "EMAIL_HOST_USER=" "$BACKEND_DIR/.env"; then
    echo "✅ .env configured"
else
    echo "⚠️  .env needs email configuration"
    echo "   Edit: $BACKEND_DIR/.env"
    echo "   Add:"
    echo "   EMAIL_HOST_USER=your-gmail@gmail.com"
    echo "   EMAIL_HOST_PASSWORD=your-app-password"
fi
echo ""

# Step 6: Summary
echo "=============================="
echo "✨ Setup Complete!"
echo "=============================="
echo ""
echo "📱 Start Backend (Terminal 1):"
echo "   cd $BACKEND_DIR"
echo "   python3 manage.py runserver 0.0.0.0:8000"
echo ""
echo "💻 Start Frontend (Terminal 2):"
echo "   cd $PROJECT_ROOT"
echo "   npm run dev"
echo ""
echo "🧪 Test Login:"
echo "   Username: testuser"
echo "   Password: testpass123"
echo ""
echo "📚 Read guides:"
echo "   - QUICK_FIX_GUIDE.md (Quick start)"
echo "   - DETAILED_FIXES.md (Detailed issues)"
echo "   - PROJECT_AUDIT.md (Full audit)"
echo ""
