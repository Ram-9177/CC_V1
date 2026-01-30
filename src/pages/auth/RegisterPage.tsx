import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'

interface RegisterForm {
  hall_ticket: string
  password: string
  password_confirm: string
  phone_number?: string
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
      await api.post('/register/', data)
      toast.success('Registration successful! Please login.')
      navigate('/login')
    } catch (error: any) {
      const errorData = error.response?.data
      const errorMsg =
        extractErrorMessage(errorData?.detail) ||
        extractErrorMessage(errorData?.hall_ticket) ||
        extractErrorMessage(errorData) ||
        'Registration failed'

      toast.error(errorMsg)
    } finally {
      setIsLoading(false)
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
          <CardTitle className="text-2xl text-center">Create an Account</CardTitle>
          <CardDescription className="text-center">
            Enter your information to get started
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="hall_ticket" className="text-sm font-medium">
                Hall Ticket Number
              </label>
              <Input
                id="hall_ticket"
                placeholder="HT123456"
                {...register('hall_ticket', { required: 'Hall ticket is required' })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
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
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password_confirm" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="password_confirm"
                type="password"
                placeholder="••••••••"
                {...register('password_confirm', { 
                  required: 'Please confirm your password',
                  validate: value => value === password || 'Passwords do not match'
                })}
                disabled={isLoading}
              />
              {errors.password_confirm && (
                <p className="text-sm text-destructive">{errors.password_confirm.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
