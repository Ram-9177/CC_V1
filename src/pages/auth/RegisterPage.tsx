import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/utils'
import { College } from '@/types'
import { AuthPageShell, AUTH_CARD_CLASS_WIDE } from '@/components/auth/AuthPageShell'

interface RegisterForm {
  hall_ticket: string
  first_name: string
  last_name: string
  email: string
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterForm>()

  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: async () => {
      const res = await api.get('/colleges/colleges/');
      return res.data.results || res.data;
    }
  });

  const password = watch('password')
  const selectedCollege = watch('college_code')

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
    <AuthPageShell>
      <Card className={AUTH_CARD_CLASS_WIDE}>
        <CardHeader className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-center justify-center">
            <img
              src="/brand-wordmark.png"
              alt="Campus Core Logo"
              className="h-16 w-auto max-w-[320px] object-contain"
            />
          </div>
          <CardTitle className="text-center text-2xl font-bold tracking-tight text-foreground">Create Your Account</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Join the hostel management system
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-3 sm:px-6">
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
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email', { required: 'Email is required' })}
                disabled={isLoading}
              />
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
                <label className="text-sm font-medium text-foreground">College</label>
                <Select 
                  onValueChange={(val) => setValue('college_code', val)} 
                  value={selectedCollege}
                  disabled={isLoading}
                >
                  <SelectTrigger className="rounded-xl border border-border bg-background">
                    <SelectValue placeholder="Select College" />
                  </SelectTrigger>
                  <SelectContent>
                    {colleges.length > 0 ? (
                      colleges.map((college) => (
                        <SelectItem key={college.id} value={college.code}>
                          {college.name} ({college.code})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No colleges found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register('password', { 
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Password must be at least 8 characters' }
                    })}
                    disabled={isLoading}
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
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="password_confirm" className="text-sm font-medium text-foreground">
                  Confirm
                </label>
                <div className="relative">
                  <Input
                    id="password_confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register('password_confirm', { 
                      required: 'Required',
                      validate: value => value === password || 'Passwords do not match'
                    })}
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            {(errors.password || errors.password_confirm) && (
              <p className="text-sm text-destructive">{errors.password?.message || errors.password_confirm?.message}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
            <Button type="submit" className="w-full rounded-xl bg-primary text-white font-semibold shadow-sm transition-all hover:bg-primary/90 active:scale-95 smooth-transition" disabled={isLoading}>
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
    </AuthPageShell>
  )
}
