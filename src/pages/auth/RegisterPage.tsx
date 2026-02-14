import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'

interface RegisterForm {
  hall_ticket: string
  first_name: string
  last_name: string
  password: string
  password_confirm: string
  phone_number: string
  
  father_name: string
  father_phone: string
  mother_name?: string
  mother_phone?: string
  guardian_name?: string
  guardian_phone?: string

  college_code: string
  address: string
}

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>()

  const password = watch('password')

  const extractErrorMessage = (payload: unknown): string | null => {
    if (!payload) return null
    if (typeof payload === 'string') return payload
    if (Array.isArray(payload)) {
      const first = payload.find((item) => typeof item === 'string')
      return first ?? null
    }
    if (typeof payload === 'object') {
      for (const value of Object.values(payload)) {
        const message = extractErrorMessage(value)
        if (message) return message
      }
    }
    return null
  }

  const onSubmit = async (data: RegisterForm) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      await api.post('/auth/register/', data)
      toast.success('Registration successful! Please login.')
      navigate('/login')
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Registration failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center premium-bg p-4">
      <Card className="w-full max-w-md premium-card border-0">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold tracking-tight text-foreground">Create Your Account</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Join the hostel management system
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">First Name</label>
                <Input {...register('first_name', { required: 'Required' })} placeholder="John" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Last Name</label>
                <Input {...register('last_name', { required: 'Required' })} placeholder="Doe" disabled={isLoading} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="hall_ticket" className="text-sm font-medium text-foreground">
                Hall Ticket Number (Username)
              </label>
              <Input
                id="hall_ticket"
                placeholder="HT123456"
                {...register('hall_ticket', { required: 'Hall ticket is required' })}
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Student Mobile</label>
                <Input {...register('phone_number', { required: 'Required' })} placeholder="9876543210" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">College Code</label>
                <Input {...register('college_code', { required: 'Required' })} placeholder="COL001" disabled={isLoading} />
              </div>
            </div>

            {/* Parent Details */}
            <div className="space-y-2 border-t pt-2 mt-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Parent Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Father's Name</label>
                  <Input {...register('father_name', { required: 'Required' })} placeholder="Name" disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Father's Phone</label>
                  <Input {...register('father_phone', { required: 'Required' })} placeholder="Number" disabled={isLoading} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mother's Name</label>
                  <Input {...register('mother_name')} placeholder="Name (Optional)" disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mother's Phone</label>
                  <Input {...register('mother_phone')} placeholder="Number (Optional)" disabled={isLoading} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Guardian Name</label>
                  <Input {...register('guardian_name')} placeholder="Name (Optional)" disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Guardian Phone</label>
                  <Input {...register('guardian_phone')} placeholder="Number (Optional)" disabled={isLoading} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Address</label>
              <Input {...register('address', { required: 'Required' })} placeholder="123, Hostel St, City" disabled={isLoading} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password', { 
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' }
                  })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password_confirm" className="text-sm font-medium text-foreground">
                  Confirm
                </label>
                <Input
                  id="password_confirm"
                  type="password"
                  placeholder="••••••••"
                  {...register('password_confirm', { 
                    required: 'Required',
                    validate: value => value === password || 'Passwords do not match'
                  })}
                  disabled={isLoading}
                />
              </div>
            </div>
            {(errors.password || errors.password_confirm) && (
              <p className="text-sm text-destructive">{errors.password?.message || errors.password_confirm?.message}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="w-full primary-gradient text-white font-semibold hover:opacity-90 smooth-transition" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline smooth-transition">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
