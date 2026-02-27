import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';

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
  const colors = ['bg-muted', 'bg-red-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-green-500'];
  const labels = ['', 'Very Weak', 'Weak', 'Medium', 'Strong'];

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`flex-1 rounded-full transition-all duration-500 ${
              strength >= level ? colors[strength] : 'bg-muted/50'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs text-right font-medium transition-colors duration-300 ${strength > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
        Strength: <span className={`${strength >= 4 ? 'text-green-600' : strength >= 3 ? 'text-yellow-600' : 'text-muted-foreground'}`}>{labels[strength]}</span>
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
      <div className="min-h-screen flex items-center justify-center premium-bg px-4">
        <Card className="w-full max-w-md premium-card border-0">
          <CardHeader className="text-center space-y-4 pt-10">
            <div className="mx-auto bg-green-100 p-4 rounded-full w-fit shadow-lg shadow-green-100/50">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div className="space-y-2">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Password Reset Complete</CardTitle>
                <CardDescription className="text-base">
                Your password has been successfully updated. You can now log in securely with your new credentials.
                </CardDescription>
            </div>
          </CardHeader>
          <CardFooter className="pb-10 pt-4 px-8">
            <Link to="/login" className="w-full">
              <Button className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20">
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center premium-bg px-4">
      <Card className="w-full max-w-md premium-card border-0">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
             <div className="p-3 bg-primary rounded-full shadow-lg shadow-primary/20">
               <Building2 className="h-8 w-8 text-white" />
             </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight text-foreground">Set New Password</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Create a strong password to secure your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                          className="h-11 bg-white/50 border-input focus:border-primary/50 transition-all text-sm pr-10"
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
                          className="h-11 bg-white/50 border-input focus:border-primary/50 transition-all text-sm pr-10"
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
              <Button type="submit" className="w-full h-11 primary-gradient text-white font-semibold hover:opacity-90 smooth-transition shadow-lg shadow-primary/20 mt-2" disabled={isLoading}>
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
    </div>
  );
}
