import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import axios from 'axios';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const otpRequestSchema = z.object({
  hall_ticket: z.string().min(3, 'Hall ticket is required'),
});

const otpVerifySchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type OtpRequestValues = z.infer<typeof otpRequestSchema>;
type OtpVerifyValues = z.infer<typeof otpVerifySchema>;

export default function RequestPasswordReset() {
  const [activeTab, setActiveTab] = useState('email');
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [hallTicket, setHallTicket] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const navigate = useNavigate();

  // Email Form
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  // OTP Request Form
  const otpRequestForm = useForm<OtpRequestValues>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { hall_ticket: '' },
  });

  // OTP Verify Form
  const otpVerifyForm = useForm<OtpVerifyValues>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { otp: '', new_password: '' },
  });

  const onEmailSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    try {
      await api.post('/auth/password-reset/', { email: data.email });
      setIsEmailSubmitted(true);
      toast.success('If an account exists, a reset link has been sent.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Something went wrong. Please try again or contact admin.'));
    } finally {
      setIsLoading(false);
    }
  };

  const onOtpRequestSubmit = async (data: OtpRequestValues) => {
    setIsLoading(true);
    try {
      await api.post('/auth/otp-request/', { hall_ticket: data.hall_ticket });
      setHallTicket(data.hall_ticket);
      setOtpStep('verify');
      toast.success('OTP sent! Please check your registered email address.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to send OTP. Make sure your hall ticket is correct and has a registered email.'));
    } finally {
      setIsLoading(false);
    }
  };

  const onOtpVerifySubmit = async (data: OtpVerifyValues) => {
    setIsLoading(true);
    try {
      await api.post('/auth/otp-verify/', {
        hall_ticket: hallTicket,
        otp: data.otp,
        new_password: data.new_password,
      });
      toast.success('Password reset successfully! Please login.');
      navigate('/login');
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && (error.response?.status === 404 || error.code === 'ERR_BAD_REQUEST')) {
        toast.error('Backend endpoint not configured. Please contact admin to reset your password.');
      } else {
        toast.error(getApiErrorMessage(error, 'Failed to verify OTP or reset password.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center premium-bg px-4">
        <Card className="w-full max-w-md premium-card border-0">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-2">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Check your email</CardTitle>
            <CardDescription className="text-muted-foreground">
              We have sent a reset link to <span className="font-semibold text-foreground">{emailForm.getValues('email')}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4 text-muted-foreground text-sm">
            <p>Click the link in the email to reset your password. If you don't see it, check your spam folder.</p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full h-11 border-primary/20 hover:border-primary/40 text-foreground transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </Link>
            <Button variant="ghost" className="text-xs text-muted-foreground" onClick={() => setIsEmailSubmitted(false)}>
              Try another email
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center premium-bg px-4">
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
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-foreground">Reset Password</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Choose a method to recover your account
          </CardDescription>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">ℹ️ Note:</span> Password reset requires backend configuration. Contact admin if this doesn't work.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="email" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-300">Email Link</TabsTrigger>
              <TabsTrigger value="otp" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-300">Hall Ticket & OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 animate-in fade-in-50 zoom-in-95 duration-300">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Email Address</FormLabel>
                        <FormControl>
                          <Input className="h-11 bg-white/50 border-input focus:border-primary/50 transition-all" placeholder="name@example.com" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="otp" className="animate-in fade-in-50 zoom-in-95 duration-300">
              {otpStep === 'request' ? (
                <Form {...otpRequestForm}>
                  <form onSubmit={otpRequestForm.handleSubmit(onOtpRequestSubmit)} className="space-y-4">
                    <FormField
                      control={otpRequestForm.control}
                      name="hall_ticket"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Hall Ticket Number</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white/50 border-input focus:border-primary/50 transition-all" placeholder="e.g. 2024TEST001" {...field} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send OTP'}
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...otpVerifyForm}>
                  <form onSubmit={otpVerifyForm.handleSubmit(onOtpVerifySubmit)} className="space-y-4">
                    <div className="text-sm text-center bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 border border-blue-100">
                      OTP Sent to registered mobile for <span className="font-bold">{hallTicket}</span>
                    </div>
                    <FormField
                      control={otpVerifyForm.control}
                      name="otp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Enter 6-digit OTP</FormLabel>
                          <FormControl>
                            <Input className="h-11 text-center text-lg tracking-widest bg-white/50 border-input focus:border-primary/50" placeholder="000000" maxLength={6} {...field} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={otpVerifyForm.control}
                      name="new_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                className="h-11 bg-white/50 border-input focus:border-primary/50 pr-10"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                {...field}
                                disabled={isLoading}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                tabIndex={-1}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-col gap-3 mt-2">
                        <Button type="submit" className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reset Password'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setOtpStep('request')} className="text-muted-foreground hover:text-foreground">
                            Change Hall Ticket
                        </Button>
                    </div>
                  </form>
                </Form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center pb-6">
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
