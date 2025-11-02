import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Building2, QrCode, Users, UtensilsCrossed, Bell } from 'lucide-react';
import { t } from '../../lib/i18n';

export function WelcomeScreen() {
  const navigate = useNavigate();

  const features = [
    { icon: QrCode, title: 'Gate Pass', desc: 'QR-based entry/exit with auto-revoke' },
    { icon: Users, title: 'Attendance', desc: 'One-tap sessions with CSV export' },
    { icon: UtensilsCrossed, title: 'Meals', desc: 'Quick-reply intents via push' },
    { icon: Bell, title: 'Notices', desc: 'Real-time updates for all roles' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-3xl mb-8">
          <Building2 className="h-24 w-24" />
        </div>
        
        <h1 className="text-5xl md:text-6xl mb-4 text-center">
          HostelConnect
        </h1>
        
        <p className="text-xl text-center text-white/90 mb-4 max-w-2xl">
          Complete hostel management solution
        </p>

        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Hallticket-First
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Bilingual Support
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Real-time Updates
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-4xl w-full">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <feature.icon className="h-8 w-8 mx-auto mb-2" />
              <h3 className="font-medium mb-1">{feature.title}</h3>
              <p className="text-xs text-white/70">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button 
            onClick={() => navigate('/login')}
            className="flex-1 bg-white text-purple-600 hover:bg-white/90 h-12"
            size="lg"
          >
            Sign In
          </Button>
          
          <Button 
            onClick={() => navigate('/role-picker')}
            variant="outline"
            className="flex-1 border-white text-white hover:bg-white/10 h-12"
            size="lg"
          >
            Demo (Pick Role)
          </Button>
        </div>

        <div className="mt-12 text-center text-white/60">
          <p className="mb-2">Production-Ready • Auto-Revoke • Ad-Gated QR • CSV Ops</p>
          <p className="text-sm">v1.0 • Built with React, NestJS, PostgreSQL</p>
        </div>
      </div>
    </div>
  );
}
