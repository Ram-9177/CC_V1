import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { HallticketChip } from '../../HallticketChip';
import { SAMPLE_STUDENT } from '../../../lib/constants';
import { Card, CardContent } from '../../ui/card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/context';
import { createGatePass } from '../../../lib/gate-passes';
import { toast } from 'sonner';

export function CreateGatePass() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    reason: '',
    destination: '',
    contactPerson: '',
    contactPhone: '',
    departTime: '',
    returnTime: '',
    type: 'CASUAL',
    priority: 'NORMAL',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        reason: formData.reason,
        destination: formData.destination,
        departureTime: new Date(formData.departTime).toISOString(),
        expectedReturn: new Date(formData.returnTime).toISOString(),
        type: formData.type,
        priority: formData.priority as any,
        contactPerson: formData.contactPerson || undefined,
        contactPhone: formData.contactPhone || undefined,
        notes: formData.notes || undefined,
      };
      const res = await createGatePass(payload);
      setSubmitted(true);
      toast.success('Gate pass submitted');
      setTimeout(() => {
        if (res?.id) navigate(`/student/gate-pass/${res.id}`);
        else navigate('/student/gate-pass');
      }, 1200);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit gate pass');
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] px-6">
        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-full mb-6">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl mb-4">Gate Pass Submitted</h2>
        <p className="text-center text-muted-foreground mb-8 max-w-sm">
          Your gate pass request has been submitted successfully. Awaiting warden approval.
        </p>
        <Card className="w-full max-w-md mb-6">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Student</span>
                <HallticketChip 
                  hallticket={user?.hallticket || SAMPLE_STUDENT.hallticket}
                  name={user?.name || SAMPLE_STUDENT.name}
                  size="sm"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Type</span>
                <span>{formData.type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <span className="text-orange-600 dark:text-orange-400">Pending Approval</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Button onClick={() => navigate('/student/gate-pass')} className="w-full max-w-xs">
          Back to Gate Pass
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/student/gate-pass')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl">Create Gate Pass</h1>
          <p className="text-muted-foreground">Fill in the details for your gate pass request</p>
        </div>
      </div>

      {/* Student Info Banner */}
      <Card>
        <CardContent className="p-4">
          <div className="text-muted-foreground text-sm mb-2">Requesting for</div>
          <HallticketChip 
            hallticket={user?.hallticket || SAMPLE_STUDENT.hallticket}
            name={user?.name || SAMPLE_STUDENT.name}
          />
        </CardContent>
      </Card>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Pass Type</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value: string) => setFormData({ ...formData, type: value })}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CASUAL" id="casual" />
                  <Label htmlFor="casual" className="cursor-pointer">Casual</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EMERGENCY" id="emergency" />
                  <Label htmlFor="emergency" className="cursor-pointer">Emergency</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ACADEMIC" id="academic" />
                  <Label htmlFor="academic" className="cursor-pointer">Academic</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="e.g., Family Function"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                placeholder="e.g., Hyderabad"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departTime">Departure Time</Label>
                <Input
                  id="departTime"
                  type="datetime-local"
                  value={formData.departTime}
                  onChange={(e) => setFormData({ ...formData, departTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="returnTime">Expected Return</Label>
                <Input
                  id="returnTime"
                  type="datetime-local"
                  value={formData.returnTime}
                  onChange={(e) => setFormData({ ...formData, returnTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person (Optional)</Label>
              <Input
                id="contactPerson"
                placeholder="Name"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone (Optional)</Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button 
            type="button"
            variant="outline"
            onClick={() => navigate('/student/gate-pass')}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="flex-1"
            disabled={!formData.reason || !formData.destination || !formData.departTime || !formData.returnTime}
          >
            Submit Gate Pass
          </Button>
        </div>
      </form>
    </div>
  );
}
