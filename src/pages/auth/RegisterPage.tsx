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
    <div className="min-h-screen flex items-center justify-center premium-bg p-4">
      <Card className="w-full max-w-md premium-card border-0">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-6">
            <div className="relative p-1.5 bg-primary/5 rounded shadow-2xl shadow-primary/5 ring-1 ring-primary/5">
              <img 
                src="/pwa/icon.svg" 
                alt="CampusCore Logo" 
                className="h-20 w-20 rounded-sm object-cover shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-sm border-2 border-white shadow-sm" />
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
                  <SelectTrigger className="rounded-sm border-0 bg-gray-50 ring-1 ring-black/5">
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
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition rounded-sm active:scale-95 transition-all" disabled={isLoading}>
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
