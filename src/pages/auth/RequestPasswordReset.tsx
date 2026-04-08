import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';

const otpRequestSchema = z.object({
  hall_ticket: z.string().min(3, 'Registration ID is required'),
});

const otpVerifySchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type OtpRequestValues = z.infer<typeof otpRequestSchema>;
type OtpVerifyValues = z.infer<typeof otpVerifySchema>;

type ResetStep = 'request' | 'verify' | 'done';

export default function RequestPasswordReset() {
  const [step, setStep] = useState<ResetStep>('request');
  const [hallTicket, setHallTicket] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [deliveryHint, setDeliveryHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const otpRequestForm = useForm<OtpRequestValues>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { hall_ticket: '' },
  });

  const otpVerifyForm = useForm<OtpVerifyValues>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { otp: '', new_password: '', confirm_password: '' },
  });

  const requestOtp = async (rawHallTicket: string) => {
    const normalizedHallTicket = rawHallTicket.trim().toUpperCase().replace(/\s+/g, '');
    const response = await api.post('/auth/otp-request/', { hall_ticket: normalizedHallTicket });
    setHallTicket(normalizedHallTicket);
    setDebugOtp(response.data?.debug_otp ?? null);
    setDeliveryHint(response.data?.email_hint ?? null);
    setStep('verify');
    return response.data;
  };

  const onOtpRequestSubmit = async (data: OtpRequestValues) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const payload = await requestOtp(data.hall_ticket);
      toast.success(payload?.message ?? 'OTP sent. Please check your registered email.');
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to send OTP. Please try again.');
      setServerError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onOtpVerifySubmit = async (data: OtpVerifyValues) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const normalizedHallTicket = hallTicket.trim().toUpperCase().replace(/\s+/g, '');
      await api.post('/auth/otp-verify/', {
        hall_ticket: normalizedHallTicket,
        otp: data.otp,
        new_password: data.new_password,
      });
      setStep('done');
      toast.success('Password reset successfully. You can log in now.');
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to verify OTP or reset password.');
      setServerError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <main id="main-content" className="min-h-screen flex items-center justify-center premium-bg px-4">
        <Card className="w-full max-w-md premium-card border-0">
          <CardHeader className="text-center space-y-4 pt-10">
            <div className="mx-auto bg-green-100 p-4 rounded-sm w-fit shadow-lg shadow-green-100/50">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Password Updated</CardTitle>
              <CardDescription className="text-base">
                Your password has been reset. Sign in with your new password to continue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="pb-10 pt-4 px-8">
            <Button
              className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20"
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center premium-bg px-4">
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
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-foreground">Forgot Password</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter your registration ID (hall ticket), request an OTP, and set a new password.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'request' ? (
            <Form {...otpRequestForm}>
              <form onSubmit={otpRequestForm.handleSubmit(onOtpRequestSubmit)} className="space-y-4">
                {serverError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    {serverError}
                  </div>
                )}
                <FormField
                  control={otpRequestForm.control}
                  name="hall_ticket"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Registration ID (Hall Ticket)</FormLabel>
                      <FormControl>
                        <Input
                          className="h-11 bg-white/50 border-input focus:border-primary/50 transition-all"
                          placeholder="e.g. STUDENT_B_BC37"
                          {...field}
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event.target.value.toUpperCase().replace(/\s+/g, ''));
                          }}
                          disabled={isLoading}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send OTP'}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...otpVerifyForm}>
              <form onSubmit={otpVerifyForm.handleSubmit(onOtpVerifySubmit)} className="space-y-4">
                {serverError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    {serverError}
                  </div>
                )}
                <div className="text-sm bg-blue-50 text-blue-700 p-3 rounded-sm border border-blue-100">
                  OTP requested for <span className="font-bold">{hallTicket}</span>.
                  {deliveryHint ? (
                    <> It was sent to <span className="font-bold">{deliveryHint}</span>.</>
                  ) : (
                    <> If an email is configured, the code was sent there.</>
                  )}
                </div>

                {debugOtp ? (
                  <div className="text-sm bg-amber-50 text-amber-800 p-3 rounded-sm border border-amber-200">
                    Local debug OTP: <span className="font-bold tracking-[0.25em]">{debugOtp}</span>
                  </div>
                ) : null}

                <FormField
                  control={otpVerifyForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">6-digit OTP</FormLabel>
                      <FormControl>
                        <Input
                          className="h-11 text-center text-lg tracking-widest bg-white/50 border-input focus:border-primary/50"
                          placeholder="000000"
                          maxLength={6}
                          {...field}
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event.target.value.replace(/\D/g, '').slice(0, 6));
                          }}
                          disabled={isLoading}
                          inputMode="numeric"
                        />
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
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword((value) => !value)}
                            aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
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

                <FormField
                  control={otpVerifyForm.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            className="h-11 bg-white/50 border-input focus:border-primary/50 pr-10"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword((value) => !value)}
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
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

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reset Password'}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      disabled={isLoading}
                      onClick={() => {
                        setStep('request');
                        setServerError(null);
                        setDebugOtp(null);
                        otpVerifyForm.reset();
                      }}
                    >
                      Change Registration ID
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11"
                      disabled={isLoading}
                      onClick={async () => {
                        setIsLoading(true);
                        setServerError(null);
                        try {
                          const payload = await requestOtp(hallTicket);
                          toast.success(payload?.message ?? 'OTP resent.');
                        } catch (error: unknown) {
                          const message = getApiErrorMessage(error, 'Failed to resend OTP.');
                          setServerError(message);
                          toast.error(message);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                    >
                      Resend OTP
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="flex justify-center pb-6">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
