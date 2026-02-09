import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store'
import { getRoleHome } from '@/lib/rbac'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'

interface LoginForm {
  hall_ticket: string
  password: string
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginForm>({ hall_ticket: '', password: '' })
  const [formErrors, setFormErrors] = useState<Partial<LoginForm>>({})
  const [isLoading, setIsLoading] = useState(false)
  const { setUser, setToken } = useAuthStore()
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
      const response = await api.post('/login/', formData)
      const { tokens, user } = response.data

      localStorage.setItem('access_token', tokens.access)
      localStorage.setItem('refresh_token', tokens.refresh)
      
      setUser(user)
      setToken(tokens.access)

      toast.success('Welcome back!')
      navigate(getRoleHome(user?.role))
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, 'Invalid credentials'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
    // Clear error when user types
    if (formErrors[id as keyof LoginForm]) {
      setFormErrors(prev => ({ ...prev, [id]: undefined }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold tracking-tight">HostelConnect</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter your credentials to access the portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="hall_ticket" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Hall Ticket Number
              </label>
              <Input
                id="hall_ticket"
                name="hall_ticket"
                placeholder="e.g. 2024TEST001"
                value={formData.hall_ticket}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
              {formErrors.hall_ticket && (
                <p className="text-sm text-destructive">{formErrors.hall_ticket}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="********"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
              {formErrors.password && (
                <p className="text-sm text-destructive">{formErrors.password}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
