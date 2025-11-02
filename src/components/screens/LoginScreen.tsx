import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Building2, ArrowLeft } from 'lucide-react';
import { t } from '../../lib/i18n';
import { toast } from 'sonner';

export function LoginScreen() {
  const [hallticket, setHallticket] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(hallticket, password);
      toast.success('Login successful!');
      
      // Redirect based on hallticket prefix
      if (hallticket.startsWith('GATEMAN')) navigate('/gateman');
      else if (hallticket.startsWith('WARDEN')) navigate('/warden');
      else if (hallticket.startsWith('CHEF')) navigate('/chef');
      else if (hallticket.startsWith('ADMIN')) navigate('/admin');
      else navigate('/student');
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-2xl">
              <Building2 className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Welcome to HostelConnect</CardTitle>
            <p className="text-muted-foreground mt-2">
              Sign in to access your account
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hallticket">Hall Ticket</Label>
              <Input
                id="hallticket"
                placeholder="Enter your hall ticket (e.g., HT001)"
                value={hallticket}
                onChange={(e) => setHallticket(e.target.value.toUpperCase())}
                required
              />
              <p className="text-xs text-muted-foreground">
                Demo: HT001 (Student), GATEMAN001, WARDEN001, CHEF001, ADMIN001
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit"
              className="w-full"
              disabled={!hallticket || !password || loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="text-center space-y-2">
              <Button 
                variant="link" 
                type="button"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Welcome
              </Button>
              <div>
                <Button variant="link" type="button" onClick={() => navigate('/signup')}>
                  New here? Create an account
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
