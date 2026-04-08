import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useAuthStore } from '@/lib/store'
import { getRoleHome } from '@/lib/rbac'
import api from '@/lib/api'
import { SEO } from '@/components/common/SEO'

const loginSchema = z.object({
  hall_ticket: z.string().trim().min(1, 'Login identifier is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface DisabledContext {
  message: string
  collegeName: string
  type: 'college' | 'hostel' | 'block' | 'floor'
}

interface DisabledPayload {
  code?: string
  detail?: string
  college_name?: string
  hostel_name?: string
  block_name?: string
  floor_num?: string | number
}

interface LoginErrorShape {
  response?: {
    status?: number
    data?: DisabledPayload
  }
  request?: unknown
}

const toDisabledContext = (payload: DisabledPayload): DisabledContext | null => {
  if (payload.code === 'COLLEGE_DISABLED') {
    return {
      message: typeof payload.detail === 'string' ? payload.detail : 'Your college is temporarily disconnected from CampusCore.',
      collegeName: payload.college_name || 'Your College',
      type: 'college',
    }
  }

  if (payload.code === 'HOSTEL_DISABLED') {
    return {
      message: typeof payload.detail === 'string' ? payload.detail : 'Your hostel is temporarily disconnected from CampusCore.',
      collegeName: payload.hostel_name || 'Your Hostel',
      type: 'hostel',
    }
  }

  if (payload.code === 'BLOCK_DISABLED') {
    return {
      message: typeof payload.detail === 'string' ? payload.detail : 'Your block/building is temporarily disconnected from CampusCore.',
      collegeName: payload.block_name || 'Your Block',
      type: 'block',
    }
  }

  if (payload.code === 'FLOOR_DISABLED') {
    return {
      message: typeof payload.detail === 'string' ? payload.detail : 'Your floor is temporarily disconnected from CampusCore.',
      collegeName: `Floor ${payload.floor_num ?? ''}`.trim() || 'Your Floor',
      type: 'floor',
    }
  }

  return null
}

const getSoftLoginErrorMessage = (error: unknown): string => {
  const status = (error as LoginErrorShape)?.response?.status
  const code = (error as LoginErrorShape)?.response?.data?.code

  if (status === 429 || code === 'TOO_MANY_ATTEMPTS') {
    return 'Too many sign-in attempts. Please wait a moment and try again.'
  }

  if (status === 400 || status === 401 || status === 403 || code === 'API_ERROR' || code === 'INVALID_CREDENTIALS') {
    return 'Unable to sign in. Check your username/email/registration ID and password, then try again.'
  }

  if (!status || (error as LoginErrorShape)?.request) {
    return 'Unable to reach CampusCore right now. Please check your connection and try again.'
  }

  if (status >= 500) {
    return 'CampusCore is temporarily unavailable. Please try again in a moment.'
  }

  return 'Unable to sign in right now. Please try again.'
}

export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { hall_ticket: '', password: '' },
  })

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [collegeDisabled, setCollegeDisabled] = useState<DisabledContext | null>(null)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Handle redirect from API interceptor when college/hostel is disabled mid-session
  useEffect(() => {
    if (searchParams.get('college_disabled') === '1') {
      const collegeName = searchParams.get('college') || 'Your College'
      const message = searchParams.get('message') || 'Your college is temporarily disconnected from CampusCore.'
      setCollegeDisabled({ collegeName, message, type: 'college' })
    } else if (searchParams.get('hostel_disabled') === '1') {
      const hostelName = searchParams.get('hostel') || 'Your Hostel'
      const message = searchParams.get('message') || 'Your hostel is temporarily disconnected from CampusCore.'
      setCollegeDisabled({ collegeName: hostelName, message, type: 'hostel' })
    } else if (searchParams.get('block_disabled') === '1') {
      const blockName = searchParams.get('block') || 'Your Block'
      const message = searchParams.get('message') || 'Your block/building is temporarily disconnected from CampusCore.'
      setCollegeDisabled({ collegeName: blockName, message, type: 'block' })
    } else if (searchParams.get('floor_disabled') === '1') {
      const floorNum = searchParams.get('floor') || 'Your Floor'
      const message = searchParams.get('message') || 'Your floor is temporarily disconnected from CampusCore.'
      setCollegeDisabled({ collegeName: `Floor ${floorNum}`, message, type: 'floor' })
    }
  }, [searchParams])

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null)
    setIsLoading(true)
    try {
      const response = await api.post('/auth/login/', {
        hall_ticket: values.hall_ticket.trim(),
        password: values.password,
      })
      const { user, tokens, password_change_required } = response.data
      const { login } = useAuthStore.getState()

      if (tokens?.access) {
        login(user, tokens.access)
      } else {
        setUser(user) // fallback if tokens are ONLY in cookies
      }

      if (password_change_required) {
        toast.info('Security check: Please change your default password to continue.', {
          duration: 6000,
        })
        navigate('/profile')
      } else {
        toast.success('Welcome back!')
        navigate(getRoleHome(user?.role))
      }
    } catch (error: unknown) {
      const payload = (error as LoginErrorShape)?.response?.data
      const disabledContext = payload ? toDisabledContext(payload) : null
      if (disabledContext) {
        setCollegeDisabled(disabledContext)
        return
      }

      const message = getSoftLoginErrorMessage(error)
      setSubmitError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center premium-bg p-4">
      <SEO 
        title="Secure Login" 
        description="Login to your SMG CampusCore account to manage your attendance, gate passes, and more."
      />

      {/* College/Hostel Disabled Screen */}
      {collegeDisabled ? (
        <Card className="w-full max-w-md premium-card border-0">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="relative p-1.5 bg-red-50 rounded ring-1 ring-red-200 shadow-2xl shadow-red-500/10">
                <img 
                  src="/pwa/icon.svg" 
                  alt="CampusCore Logo" 
                  loading="lazy"
                  className="h-20 w-20 rounded-sm object-cover shadow-sm grayscale opacity-60"
                />
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-red-500 rounded-sm border-2 border-white shadow-sm flex items-center justify-center">
                  <span className="text-white text-xs font-black">✕</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] mb-2">
                {collegeDisabled.type === 'college' && 'College Suspended'}
                {collegeDisabled.type === 'hostel' && 'Hostel Suspended'}
                {collegeDisabled.type === 'block' && 'Block Suspended'}
                {collegeDisabled.type === 'floor' && 'Floor Suspended'}
              </div>
              <h2 className="text-xl font-black text-foreground tracking-tight mb-1">{collegeDisabled.collegeName}</h2>
              <div className="h-1 w-12 bg-red-400 rounded-sm mx-auto mb-4" />
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                {collegeDisabled.message}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-sm p-4">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
                🔒 Access Restricted
              </p>
              <p className="text-xs text-red-600 mt-1">
                {collegeDisabled.type === 'college' 
                  ? 'Please contact your college administration for assistance.'
                  : 'Please contact your hostel warden or administration for assistance.'}
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full rounded-sm h-11 font-bold border-2"
              onClick={() => setCollegeDisabled(null)}
            >
              ← Back to Login
            </Button>
          </CardContent>
        </Card>
      ) : (
      <Card className="w-full max-w-md premium-card border-0">

        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <div className="relative p-1.5 bg-primary/5 rounded ring-1 ring-primary/5 shadow-2xl shadow-primary/5">
              <img 
                src="/Logo.png" 
                alt="CampusCore Logo" 
                loading="lazy"
                className="h-24 w-24 object-contain shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-sm border-2 border-white shadow-sm" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-black tracking-tight text-black">
            Welcome to
            {' '}
            <span aria-label="CampusCore" className="inline-block text-black">
              <span className="text-primary italic">C</span>
              ampus
              <span className="text-primary italic">C</span>
              ore
            </span>
          </CardTitle>
          <CardDescription className="text-center text-black font-semibold">
            Sign in using your username, email, or registration ID
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {submitError}
                </div>
              )}

              <FormField
                control={form.control}
                name="hall_ticket"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Username / Email / Registration ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. 23B91A1234 or your username"
                        value={field.value}
                        onChange={(event) => {
                          field.onChange(event.target.value.replace(/^\s+/, ''))
                          if (submitError) setSubmitError(null)
                        }}
                        disabled={isLoading}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoComplete="username"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Use whichever identifier you were given during onboarding.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="********"
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event.target.value)
                            if (submitError) setSubmitError(null)
                          }}
                          disabled={isLoading}
                          autoComplete="current-password"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="sr-only">Toggle password visibility</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Link 
                  to="/forgot-password" 
                  className="text-sm font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30" 
                loading={isLoading}
              >
                Sign In
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      )}
    </main>
  )
}
