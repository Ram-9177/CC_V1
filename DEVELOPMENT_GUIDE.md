# Development Guide - Security & Stability

## Quick Reference for New Features

### Adding a New API Endpoint with Proper Security

#### Backend (Django)

```python
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsStudent
from core.security import InputValidator, AuditLogger
from core.errors import ValidationAPIError, api_error_response
import logging

logger = logging.getLogger(__name__)

class YourViewSet(viewsets.ModelViewSet):
    """Your viewset with security."""
    
    queryset = YourModel.objects.all()
    serializer_class = YourSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Conditional permission assignment."""
        if self.action == 'create':
            return [IsAuthenticated()]
        elif self.action in ['destroy', 'update']:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]
    
    def create(self, request, *args, **kwargs):
        """Create with input validation."""
        try:
            # Validate input
            name = request.data.get('name', '').strip()
            name = InputValidator.validate_string(name, 'name', 500)
            
            # Sanitize
            request.data['name'] = name
            
            # Create
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            instance = serializer.save()
            
            # Audit log
            AuditLogger.log_action(request.user.id, 'create', 'your_model', instance.id, success=True)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            AuditLogger.log_action(request.user.id, 'create', 'your_model', 0, success=False)
            return api_error_response(str(e), "VALIDATION_ERROR", status_code=400)
        except Exception as e:
            logger.error(f"Create error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)
```

#### Frontend (React + TypeScript)

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { validateInput, sanitizeInput } from '@/lib/validation';
import { toast } from 'sonner';

interface YourData {
  id: number;
  name: string;
  // ...
}

export function YourComponent() {
  const queryClient = useQueryClient();
  
  // Query with proper typing
  const { data = [], isLoading, error } = useQuery<YourData[]>({
    queryKey: ['your_endpoint'],
    queryFn: async () => {
      const response = await api.get('/your-endpoint/');
      return response.data.data || response.data;
    },
  });
  
  // Mutation with validation
  const createMutation = useMutation({
    mutationFn: async (formData: Partial<YourData>) => {
      // Validate
      const validation = validateInput(formData);
      if (!validation.isValid) {
        throw new Error(validation.errors[0].message);
      }
      
      // Sanitize
      const sanitized = {
        ...formData,
        name: sanitizeInput(formData.name || ''),
      };
      
      // Submit
      const response = await api.post('/your-endpoint/', sanitized);
      return response.data.data || response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['your_endpoint'] });
      toast.success('Created successfully');
    },
    onError: (error: any) => {
      const message = getApiErrorMessage(error, 'Failed to create');
      toast.error(message);
    },
  });
  
  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

---

## Common Security Patterns

### 1. Role-Based Access Control

```python
# Backend - Check role
from core.permissions import user_is_admin, user_is_staff

if not user_is_admin(request.user):
    return api_error_response("Only admins can access", status_code=403)

# Frontend - Hide UI elements
import { useAuthStore } from '@/lib/store';

const user = useAuthStore(state => state.user);
const isAdmin = user?.role === 'admin';

if (!isAdmin) return null; // Hide component
```

### 2. Input Validation Pattern

```python
# Backend
try:
    email = InputValidator.validate_email(request.data.get('email'))
    phone = InputValidator.validate_phone(request.data.get('phone'))
except ValidationError as e:
    return api_error_response(str(e), "VALIDATION_ERROR")

# Frontend
import { validateEmail, validatePhone } from '@/lib/validation';

const emailResult = validateEmail(formData.email);
if (!emailResult.isValid) {
  setErrors({ email: emailResult.errors[0].message });
}
```

### 3. Ownership Validation Pattern

```python
# Backend - Check user owns resource
from core.errors import PermissionAPIError

resource = YourModel.objects.get(id=pk)
if resource.user_id != request.user.id and not user_is_admin(request.user):
    AuditLogger.log_action(request.user.id, 'access', 'resource', pk, success=False)
    raise PermissionAPIError("You cannot access this resource")
```

### 4. Audit Logging Pattern

```python
# Backend - Log important actions
from core.security import AuditLogger

AuditLogger.log_action(
    user_id=request.user.id,
    action='approve',
    resource_type='gate_pass',
    resource_id=gate_pass.id,
    details={'remarks': remarks},
    success=True
)
```

### 5. Error Handling Pattern

```python
# Backend - Consistent error responses
from core.errors import api_error_response, api_success_response

try:
    # Do something
    result = do_something()
    return api_success_response(data=result, message="Success")
except ValidationError as e:
    return api_error_response(str(e), "VALIDATION_ERROR")
except PermissionDenied as e:
    return api_error_response(str(e), "PERMISSION_DENIED", status_code=403)
except Exception as e:
    logger.error(f"Unexpected error: {str(e)}")
    return api_error_response("An error occurred", "ERROR")
```

---

## Testing Checklist for New Features

### Security Checklist
- [ ] Input validation is implemented on both frontend and backend
- [ ] XSS prevention (input sanitization)
- [ ] CSRF token is included in forms
- [ ] Permission checks are in place
- [ ] Audit logging is implemented
- [ ] Error messages don't leak sensitive information
- [ ] Rate limiting is considered

### Stability Checklist
- [ ] All errors are caught and handled gracefully
- [ ] No `any` types in TypeScript
- [ ] Proper typing for all functions
- [ ] WebSocket errors are handled
- [ ] Network timeout handling is in place
- [ ] Race conditions are prevented
- [ ] State is properly initialized

### Logic Checklist
- [ ] Edge cases are handled
- [ ] Business rules are enforced
- [ ] Data consistency is maintained
- [ ] Status transitions are validated
- [ ] Time windows/validations are correct
- [ ] Ownership/access rules are enforced

---

## Debugging Tips

### Backend Logging
```python
import logging
logger = logging.getLogger(__name__)

logger.debug("Debug info")      # Development debugging
logger.info("User action")       # Important events
logger.warning("Suspicious")     # Potential issues
logger.error("Operation failed") # Errors with context
```

### Frontend Debugging
```typescript
// Development only
if (process.env.NODE_ENV === 'development') {
  console.log('Debug:', data);
}

// Check network in DevTools
// Check React Query DevTools: import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
```

### WebSocket Debugging
```typescript
// Monitor connection status
const { isConnected } = useWebSocketStatus();
console.log('WebSocket connected:', isConnected);

// Listen to specific events
useWebSocketEvent('event_name', (data) => {
  console.log('Event received:', data);
});
```

---

## Performance Tips

### Frontend
1. **Use React Query devtools** to monitor queries
2. **Memoize components** if they have expensive computations
3. **Use code splitting** for large features
4. **Lazy load routes** with React.lazy()
5. **Monitor bundle size** with `npm run build`

### Backend
1. **Use select_related/prefetch_related** to prevent N+1 queries
2. **Add database indexes** on frequently searched fields
3. **Use pagination** for list endpoints
4. **Cache computed values** when appropriate
5. **Monitor slow queries** in logs

---

## Deployment Guide

### Pre-deployment Checks
```bash
# Frontend
npm run build              # Ensure clean build
npm run test              # Run tests if available

# Backend
python manage.py test     # Run tests
python manage.py migrate  # Check migrations
python manage.py check    # Check configuration
```

### Environment Configuration
```bash
# .env.production
DEBUG=False
ALLOWED_HOSTS=yourdomain.com
DATABASE_URL=postgresql://user:pass@host/db
SECRET_KEY=<generate-strong-key>
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Post-deployment Verification
- [ ] Test login flow
- [ ] Verify API endpoints
- [ ] Check WebSocket connection
- [ ] Monitor error logs
- [ ] Verify email notifications
- [ ] Test user workflows

---

## Getting Help

### Resources
- Django DRF Documentation: https://www.django-rest-framework.org/
- React Query Docs: https://tanstack.com/query/latest
- Security Best Practices: https://owasp.org/www-project-top-ten/
- TypeScript Handbook: https://www.typescriptlang.org/docs/

### Reporting Issues
When reporting security issues:
1. **Don't** post publicly
2. **Email** security@yourdomain.com
3. Include detailed reproduction steps
4. Include affected versions
5. Allow time for patching before disclosure
