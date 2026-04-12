import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { AuthPageShell, AUTH_CARD_CLASS } from '@/components/auth/AuthPageShell';

const formSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof formSchema>;

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const strength = calculateStrength(password);
  const colors = ['bg-muted', 'bg-destructive', 'bg-primary/80', 'bg-primary', 'bg-success'];
  const labels = ['', 'Very Weak', 'Weak', 'Medium', 'Strong'];

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`flex-1 rounded-sm transition-all duration-500 ${
              strength >= level ? colors[strength] : 'bg-muted/50'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs text-right font-medium transition-colors duration-300 ${strength > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
        Strength:{' '}
        <span
          className={
            strength >= 4
              ? 'text-success'
              : strength >= 2
                ? 'text-primary'
                : strength >= 1
                  ? 'text-destructive'
                  : 'text-muted-foreground'
          }
        >
          {labels[strength]}
        </span>
      </p>
    </div>
  );
};

const calculateStrength = (password: string) => {
  if (!password) return 0;
  let score = 0;
  if (password.length > 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

export default function ResetPasswordConfirm() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  /* const navigate = useNavigate(); // Not needed as we show success screen */
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange' // Validate on change for strength indicator
  });

  const onSubmit = async (data: FormValues) => {
    if (!uid || !token) {
        toast.error('Invalid reset link');
        return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/password-reset-confirm/', {
        uid,
        token,
        password: data.password,
      });
      setIsSuccess(true);
      toast.success('Password reset successfully!');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to reset password. The link may be expired or invalid.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthPageShell>
        <Card className={AUTH_CARD_CLASS}>
          <CardHeader className="space-y-4 px-5 pt-8 text-center sm:px-6">
            <div className="mx-auto w-fit rounded-xl border border-success/25 bg-success/15 p-4 shadow-sm">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div className="space-y-2">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Password Reset Complete</CardTitle>
                <CardDescription className="text-base">
                Your password has been successfully updated. You can now log in securely with your new credentials.
                </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="px-5 pb-8 pt-3 sm:px-6">
            <Link to="/login" className="w-full">
              <Button className="h-11 w-full rounded-xl primary-gradient text-white font-semibold shadow-sm smooth-transition hover:opacity-90">
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <Card className={AUTH_CARD_CLASS}>
        <CardHeader className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-4 flex items-center justify-center">
            <div className="relative rounded-xl bg-primary/5 p-2 ring-1 ring-primary/10">
              <img 
                src="/brand-wordmark.png" 
                alt="Campus Core Logo" 
                className="h-16 w-auto max-w-[320px] object-contain shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-sm border-2 border-card bg-success shadow-sm" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-foreground">Set New Password</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Create a strong password to secure your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-3 sm:px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="h-11 rounded-xl border-input bg-background pr-10 text-sm transition-all focus:border-primary/50"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <PasswordStrengthIndicator password={field.value} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="h-11 rounded-xl border-input bg-background pr-10 text-sm transition-all focus:border-primary/50"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
              <Button type="submit" className="mt-2 h-11 w-full rounded-xl primary-gradient text-white font-semibold shadow-sm smooth-transition hover:opacity-90" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
