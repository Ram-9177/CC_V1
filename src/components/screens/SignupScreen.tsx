import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/context';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Building2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { hasBackend } from '../../lib/config';
import type { Role } from '../../lib/types';

export function SignupScreen() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    hallticket: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasBackend()) {
      toast.error('Backend not configured');
      return;
    }
    if (!form.hallticket || !form.password) {
      toast.error('Hallticket and password are required');
      return;
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register({
        hallticket: form.hallticket,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
      });
      toast.success('Account created');
      navigate('/');
    } catch (e: any) {
      toast.error(e?.message || 'Sign up failed');
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
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <p className="text-muted-foreground mt-2">Sign up to access HostelConnect</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Hall Ticket</Label>
              <Input value={form.hallticket} onChange={(e) => setForm({ ...form, hallticket: e.target.value.toUpperCase() })} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Confirm</Label>
                <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing up…' : 'Sign Up'}
            </Button>

            <div className="text-center">
              <Button variant="link" type="button" onClick={() => navigate('/login')}>
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
