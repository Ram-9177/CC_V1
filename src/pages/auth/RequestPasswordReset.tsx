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
      <main id="main-content" className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-6 dark:bg-slate-950">
        <Card className="w-full max-w-md rounded-xl border border-border/70 bg-card shadow-sm">
          <CardHeader className="space-y-4 px-5 pt-8 text-center sm:px-6">
            <div className="mx-auto w-fit rounded-xl bg-green-100 p-4 shadow-sm dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Password Updated</CardTitle>
              <CardDescription className="text-base">
                Your password has been reset. Sign in with your new password to continue.
              </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="px-5 pb-8 pt-3 sm:px-6">
            <Button
              className="h-11 w-full rounded-xl primary-gradient text-white font-semibold shadow-sm smooth-transition hover:opacity-90"
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
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-6 dark:bg-slate-950">
      <Card className="w-full max-w-md rounded-xl border border-border/70 bg-card shadow-sm">
        <CardHeader className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-center justify-center">
            <div className="relative rounded-xl bg-primary/5 p-2 ring-1 ring-primary/10">
              <img
                src="/brand-wordmark.png"
                alt="Campus Core Logo"
                className="h-16 w-auto max-w-[320px] object-contain shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-sm border-2 border-white shadow-sm" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-foreground">Forgot Password</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter your registration ID (hall ticket), request an OTP, and set a new password.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-5 py-3 sm:px-6">
          {step === 'request' ? (
            <Form {...otpRequestForm}>
              <form onSubmit={otpRequestForm.handleSubmit(onOtpRequestSubmit)} className="space-y-4">
                {serverError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
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
                          className="h-11 rounded-xl border-input bg-background focus:border-primary/50 transition-all"
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
                  className="h-11 w-full rounded-xl primary-gradient text-white font-semibold shadow-sm smooth-transition hover:opacity-90"
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
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {serverError}
                  </div>
                )}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                  OTP requested for <span className="font-bold">{hallTicket}</span>.
                  {deliveryHint ? (
                    <> It was sent to <span className="font-bold">{deliveryHint}</span>.</>
                  ) : (
                    <> If an email is configured, the code was sent there.</>
                  )}
                </div>

                {debugOtp ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
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
                          className="h-11 rounded-xl border-input bg-background text-center text-lg tracking-widest focus:border-primary/50"
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
                            className="h-11 rounded-xl border-input bg-background pr-10 focus:border-primary/50"
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
                            className="h-11 rounded-xl border-input bg-background pr-10 focus:border-primary/50"
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
                    className="h-11 w-full rounded-xl primary-gradient text-white font-semibold shadow-sm smooth-transition hover:opacity-90"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reset Password'}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
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
                      className="h-11 rounded-xl"
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

        <CardFooter className="flex justify-center px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
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
