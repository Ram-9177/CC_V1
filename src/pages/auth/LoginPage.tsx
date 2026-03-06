import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store'
import { getRoleHome } from '@/lib/rbac'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { SEO } from '@/components/common/SEO'

interface LoginForm {
  hall_ticket: string
  password: string
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginForm>({ hall_ticket: '', password: '' })
  const [formErrors, setFormErrors] = useState<Partial<LoginForm>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [collegeDisabled, setCollegeDisabled] = useState<{ message: string; collegeName: string; type: 'college' | 'hostel' | 'block' | 'floor' } | null>(null)
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Handle redirect from API interceptor when college/hostel is disabled mid-session
  useEffect(() => {
    if (searchParams.get('college_disabled') === '1') {
      const collegeName = searchParams.get('college') || 'Your College'
      const message = searchParams.get('message') || 'Your college is temporarily disconnected from HostelConnect.'
      setCollegeDisabled({ collegeName, message, type: 'college' })
    } else if (searchParams.get('hostel_disabled') === '1') {
      const hostelName = searchParams.get('hostel') || 'Your Hostel'
      const message = searchParams.get('message') || 'Your hostel is temporarily disconnected from HostelConnect.'
      setCollegeDisabled({ collegeName: hostelName, message, type: 'hostel' })
    } else if (searchParams.get('block_disabled') === '1') {
      const blockName = searchParams.get('block') || 'Your Block'
      const message = searchParams.get('message') || 'Your block/building is temporarily disconnected from HostelConnect.'
      setCollegeDisabled({ collegeName: blockName, message, type: 'block' })
    } else if (searchParams.get('floor_disabled') === '1') {
      const floorNum = searchParams.get('floor') || 'Your Floor'
      const message = searchParams.get('message') || 'Your floor is temporarily disconnected from HostelConnect.'
      setCollegeDisabled({ collegeName: `Floor ${floorNum}`, message, type: 'floor' })
    }
  }, [searchParams])

  const validate = () => {
    const errors: Partial<LoginForm> = {}
    if (!formData.hall_ticket.trim()) errors.hall_ticket = 'Hall ticket is required'
    if (!formData.password.trim()) errors.password = 'Password is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      const response = await api.post('/auth/login/', formData)
      const { user, password_change_required } = response.data
      
      setUser(user)
      
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
      // Check for COLLEGE_DISABLED or HOSTEL_DISABLED error code
      if (
        typeof error === 'object' && error !== null && 'response' in error
      ) {
        const axiosErr = error as { response?: { data?: { code?: string; detail?: string; college_name?: string; hostel_name?: string; block_name?: string; floor_num?: string | number } } }
        const data = axiosErr.response?.data
        if (data?.code === 'COLLEGE_DISABLED') {
          setCollegeDisabled({
            message: typeof data.detail === 'string' ? data.detail : 'Your college is temporarily disconnected from HostelConnect.',
            collegeName: data.college_name || 'Your College',
            type: 'college',
          })
          return
        }
        if (data?.code === 'HOSTEL_DISABLED') {
          setCollegeDisabled({
            message: typeof data.detail === 'string' ? data.detail : 'Your hostel is temporarily disconnected from HostelConnect.',
            collegeName: data.hostel_name || 'Your Hostel',
            type: 'hostel',
          })
          return
        }
        if (data?.code === 'BLOCK_DISABLED') {
          setCollegeDisabled({
            message: typeof data.detail === 'string' ? data.detail : 'Your block/building is temporarily disconnected from HostelConnect.',
            collegeName: data.block_name || 'Your Block',
            type: 'block',
          })
          return
        }
        if (data?.code === 'FLOOR_DISABLED') {
          setCollegeDisabled({
            message: typeof data.detail === 'string' ? data.detail : 'Your floor is temporarily disconnected from HostelConnect.',
            collegeName: `Floor ${data.floor_num}` || 'Your Floor',
            type: 'floor',
          })
          return
        }
      }
      toast.error(getApiErrorMessage(error, 'Invalid credentials'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    const normalized = id === 'hall_ticket' ? value.toUpperCase().replace(/\s+/g, '') : value
    setFormData(prev => ({ ...prev, [id]: normalized }))
    // Clear error when user types
    if (formErrors[id as keyof LoginForm]) {
      setFormErrors(prev => ({ ...prev, [id]: undefined }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center premium-bg p-4">
      <SEO 
        title="Secure Login" 
        description="Login to your SMG Hostel Connect account to manage your attendance, gate passes, and more."
      />

      {/* College/Hostel Disabled Screen */}
      {collegeDisabled ? (
        <Card className="w-full max-w-md premium-card border-0">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="relative p-1.5 bg-red-50 rounded-[2rem] shadow-2xl shadow-red-500/10 ring-1 ring-red-200">
                <img 
                  src="/pwa/icon-180.png" 
                  alt="HostelConnect Logo" 
                  className="h-20 w-20 rounded-[1.8rem] object-cover shadow-sm grayscale opacity-60"
                />
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-red-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
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
              <div className="h-1 w-12 bg-red-400 rounded-full mx-auto mb-4" />
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                {collegeDisabled.message}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
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
              className="w-full rounded-2xl h-11 font-bold border-2"
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
            <div className="relative p-1.5 bg-primary/5 rounded-[2rem] shadow-2xl shadow-primary/5 ring-1 ring-primary/5">
              <img 
                src="/pwa/icon-180.png" 
                alt="HostelConnect Logo" 
                className="h-20 w-20 rounded-[1.8rem] object-cover shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-black tracking-tight text-black">Welcome to HostelConnect</CardTitle>
          <CardDescription className="text-center text-black font-semibold">
            Enter your login details below
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="hall_ticket" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Hall Ticket Number
              </label>
              <Input
                id="hall_ticket"
                name="hall_ticket"
                placeholder="Enter your hall ticket number"
                value={formData.hall_ticket}
                onChange={handleChange}
                disabled={isLoading}
                required
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
              />
              {formErrors.hall_ticket && (
                <p className="text-sm text-destructive">{formErrors.hall_ticket}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
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
              {formErrors.password && (
                <p className="text-sm text-destructive">{formErrors.password}</p>
              )}
            </div>
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
            <p className="text-sm text-center text-black font-medium">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary font-bold hover:underline smooth-transition">
                Register here
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      )}
    </div>
  )
}
