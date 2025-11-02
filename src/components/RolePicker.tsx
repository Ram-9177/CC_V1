import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/context';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Role } from '../lib/types';
import { User, Shield, Utensils, ScanLine, Crown, ArrowLeft } from 'lucide-react';
import { t } from '../lib/i18n';

const ROLE_CONFIG: Record<Role, { label: string; icon: any; description: string; color: string }> = {
  STUDENT: {
    label: t('student'),
    icon: User,
    description: 'Access gate passes, attendance, and meals',
    color: 'bg-blue-600',
  },
  WARDEN: {
    label: t('warden'),
    icon: Shield,
    description: 'Manage approvals and attendance sessions',
    color: 'bg-purple-600',
  },
  WARDEN_HEAD: {
    label: 'Warden Head',
    icon: Shield,
    description: 'Full warden access with additional permissions',
    color: 'bg-purple-700',
  },
  CHEF: {
    label: t('chef'),
    icon: Utensils,
    description: 'Manage meals board, menu, and intents',
    color: 'bg-orange-600',
  },
  GATEMAN: {
    label: t('gateman'),
    icon: ScanLine,
    description: 'Scan QR codes and manage gate operations',
    color: 'bg-green-600',
  },
  SUPER_ADMIN: {
    label: t('admin'),
    icon: Crown,
    description: 'Full system access and user management',
    color: 'bg-red-600',
  },
};

export function RolePicker() {
  const navigate = useNavigate();
  const { switchRole } = useAuth();

  const handleSelect = (role: Role) => {
    switchRole(role);
    const target =
      role === 'WARDEN_HEAD' ? '/warden' :
      role === 'SUPER_ADMIN' ? '/admin' :
      role === 'GATEMAN' ? '/gateman' :
      role === 'CHEF' ? '/chef' :
      role === 'WARDEN' ? '/warden' :
      '/student';
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('welcome')} to HostelConnect</CardTitle>
          <p className="text-muted-foreground mt-2">
            Choose a role to explore the demo
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(ROLE_CONFIG).map(([role, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={role}
                  variant="outline"
                  className="h-auto p-4 justify-start hover:bg-accent"
                  onClick={() => handleSelect(role as Role)}
                >
                  <div className={`${config.color} p-2 rounded-lg mr-3`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">{config.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {config.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <Button variant="link" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to welcome
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
