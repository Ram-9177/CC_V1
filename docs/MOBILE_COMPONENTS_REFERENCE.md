# 📱 Mobile UI Components - Quick Reference

## Import Statements

```tsx
// Layout components
import { 
  MobilePageContainer,
  MobileSection, 
  MobileActionBar, 
  MobileFormContainer,
  MobileFormField,
  MobileListItem,
  MobileModal 
} from '@/components/common/MobileUI'

// Card components
import { 
  MobileCard, 
  MobileGrid, 
  MobileStatCard 
} from '@/components/common/MobileCard'

// Input components
import { 
  MobileInput, 
  MobileButton, 
  MobileSelect,
  MobileTextarea,
  MobileCheckbox,
  MobileRadio 
} from '@/components/common/MobileInputs'
```

## Common Patterns

### 1. Full Page with Header

```tsx
<MobilePageContainer title="Gate Passes" subtitle="Manage your passes">
  <MobileSection title="Active Passes" subtitle="Valid until tomorrow">
    <MobileGrid cols={{ mobile: 1, sm: 2, md: 3 }}>
      {passes.map(pass => (
        <MobileCard key={pass.id} onClick={() => navigate(`/gate-passes/${pass.id}`)}>
          <div className="space-y-2">
            <h3 className="font-bold">{pass.destination}</h3>
            <p className="text-sm text-muted-foreground">{pass.exit_date}</p>
          </div>
        </MobileCard>
      ))}
    </MobileGrid>
  </MobileSection>
</MobilePageContainer>
```

### 2. Form with Validation

```tsx
<MobilePageContainer title="Submit Complaint">
  <MobileFormContainer>
    <MobileFormField label="Category" required error={errors.category}>
      <MobileSelect value={formData.category} onChange={handleChange}>
        <option value="">Select category</option>
        <option value="electrical">Electrical</option>
        <option value="plumbing">Plumbing</option>
      </MobileSelect>
    </MobileFormField>

    <MobileFormField label="Description" required error={errors.description}>
      <MobileTextarea 
        placeholder="Describe the issue" 
        value={formData.description}
        onChange={handleChange}
      />
    </MobileFormField>

    <MobileButton variant="primary" onClick={submitForm}>
      Submit Complaint
    </MobileButton>
  </MobileFormContainer>
</MobilePageContainer>
```

### 3. List with Actions

```tsx
<MobileSection title="Upcoming Meals">
  <div className="space-y-1">
    {meals.map(meal => (
      <MobileListItem key={meal.id} onClick={() => navigate(`/meals/${meal.id}`)}>
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-bold">{meal.meal_type}</h4>
            <p className="text-xs text-muted-foreground">{meal.date}</p>
          </div>
          <span className="text-sm font-semibold text-primary">
            {meal.is_registered ? '✓' : 'Register'}
          </span>
        </div>
      </MobileListItem>
    ))}
  </div>
</MobileSection>
```

### 4. Statistics Dashboard

```tsx
<MobilePageContainer title="Dashboard">
  <MobileSection title="Quick Stats">
    <MobileGrid cols={{ mobile: 1, sm: 2, md: 2 }}>
      <MobileStatCard 
        label="Attendance"
        value={`${stats.attendance}%`}
        icon={Activity}
        color="primary"
      />
      <MobileStatCard 
        label="Pending Passes"
        value={stats.pending}
        icon={ClipboardCheck}
        color="blue"
      />
    </MobileGrid>
  </MobileSection>

  <MobileSection title="Recent Activity">
    <MobileCard>
      <div className="text-center py-8">
        <p className="text-muted-foreground">No recent activity</p>
      </div>
    </MobileCard>
  </MobileSection>
</MobilePageContainer>
```

### 5. Action Modal

```tsx
const [modalOpen, setModalOpen] = useState(false)

<MobileModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  title="Confirm Action"
  actions={
    <>
      <MobileButton 
        variant="secondary" 
        onClick={() => setModalOpen(false)}
        size="md"
      >
        Cancel
      </MobileButton>
      <MobileButton 
        variant="primary" 
        onClick={handleConfirm}
        size="md"
      >
        Confirm
      </MobileButton>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</MobileModal>
```

## Responsive Classes Cheat Sheet

```tsx
// Text sizes
className="text-sm sm:text-base md:text-lg"

// Padding
className="p-3 sm:p-4 md:p-6"

// Grid columns
className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3"

// Gaps
className="gap-3 sm:gap-4 md:gap-6"

// Hide/Show
className="hidden sm:block"      // Show on tablet+
className="block sm:hidden"      // Show on mobile only
className="hidden md:block"      // Show on desktop+
className="hidden xs:block"      // Hide on very small (internal utility)
```

## Color Variants

All button and stat card components support:
- `primary` - Main brand color
- `secondary` - Secondary actions
- `destructive` - Danger actions
- `ghost` - Transparent background

## Button Sizes

```tsx
<MobileButton size="sm">Small</MobileButton>      {/* 40px */}
<MobileButton size="md">Medium (default)</MobileButton>  {/* 44px */}
<MobileButton size="lg">Large</MobileButton>      {/* 48px */}
```

## Spacing Guide

| Property | Mobile | Tablet | Desktop |
|----------|--------|--------|---------|
| `p-3` | 12px | 12px | 12px |
| `p-3 sm:p-4` | 12px | 16px | 16px |
| `gap-3 sm:gap-4` | 12px | 16px | 16px |
| `pb-20 sm:pb-24` | 80px | 96px | 96px |

## Touch Target Sizes

All interactive elements have minimum 44x44px:
- Buttons: `h-[44px] px-4 py-3`
- Inputs: `h-[44px] px-4 py-3`
- List items: `p-4` (at least 44px in height with content)
- Icons: `h-5 w-5` (minimum, can be larger)

## Forms Best Practices

```tsx
// ✅ GOOD - Full width, proper spacing, validation
<MobileFormContainer>
  <MobileFormField label="Email" required error={error}>
    <MobileInput 
      type="email"
      placeholder="you@example.com"
      value={value}
      onChange={handleChange}
    />
  </MobileFormField>
</MobileFormContainer>

// ❌ BAD - Not using mobile components
<form>
  <input className="w-full p-2" />
  <button className="px-4 py-2">Submit</button>
</form>
```

## Testing Commands

```bash
# Check TypeScript
npx tsc --noEmit

# Build for production
npm run build

# Check responsive on mobile width
# Open browser DevTools → Toggle device toolbar
# Set to 375px width (iPhone SE)
```

## Common Issues & Solutions

### Issue: Input too small on mobile
```tsx
// ❌ Don't do this
<input className="p-2 h-10" />

// ✅ Use MobileInput instead
<MobileInput />
```

### Issue: Button not clickable on mobile
```tsx
// ❌ Don't do this (too small)
<button className="w-8 h-8">Action</button>

// ✅ Use MobileButton instead
<MobileButton>Action</MobileButton>
```

### Issue: Form cramped on mobile
```tsx
// ❌ Don't do this
<form className="grid grid-cols-3 gap-1">

// ✅ Use MobileFormContainer instead
<MobileFormContainer>
  <MobileFormField>...</MobileFormField>
</MobileFormContainer>
```

## Performance Tips

1. **Use MobileGrid for responsive layouts** - Automatically handles breakpoints
2. **Use MobileCard for consistent styling** - Reduces custom CSS
3. **Use MobileButton for all buttons** - Ensures proper touch targets
4. **Avoid custom media queries** - Let Tailwind handle it
5. **Test on real devices** - DevTools doesn't show everything

## Accessibility Checklist

- [x] All buttons have `aria-label` or visible text
- [x] Form inputs have associated `<label>`
- [x] Focus rings visible (`:focus:ring-2`)
- [x] Touch targets ≥ 44x44px
- [x] Color not only indicator
- [x] Proper heading hierarchy
- [x] Links underlined or styled differently from text

---

**Last Updated:** February 14, 2026
