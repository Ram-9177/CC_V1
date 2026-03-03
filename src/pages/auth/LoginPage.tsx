import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'

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
  const { setUser } = useAuthStore()
  const navigate = useNavigate()

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
      const { user } = response.data
      
      setUser(user)
      // Note: Token is set in HttpOnly cookie by backend. 
      // JS cannot access it for security (XSS protection).

      toast.success('Welcome back!')
      navigate(getRoleHome(user?.role))
    } catch (error: unknown) {
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
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition rounded-lg active:scale-95 transition-all" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
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
    </div>
  )
}
