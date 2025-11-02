import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Label } from '../../ui/label';
import { Calendar } from '../../ui/calendar';
import { t } from '../../../lib/i18n';
import { MealChoice } from '../../../lib/types';
import { getMyIntents, listMenus, setMyIntent } from '../../../lib/meals';
import { Coffee, Sun, Moon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSocketEvent } from '../../../lib/socket';

export function MealsView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [intents, setIntents] = useState<Record<string, MealChoice>>({
    'BREAKFAST': 'YES',
    'LUNCH': 'YES',
    'DINNER': 'SAME',
  });
  const [menus, setMenus] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const dateISO = selectedDate.toISOString().split('T')[0];
        const [m, mine] = await Promise.all([
          listMenus(dateISO),
          getMyIntents(dateISO),
        ]);
        setMenus(m);
        if (mine) setIntents(mine as any);
      } catch {}
    })();
  }, [selectedDate]);

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'BREAKFAST':
        return <Coffee className="h-5 w-5" />;
      case 'LUNCH':
        return <Sun className="h-5 w-5" />;
      case 'DINNER':
        return <Moon className="h-5 w-5" />;
    }
  };

  const handleIntentChange = (mealType: string, choice: MealChoice) => {
    setIntents((prev: any) => ({ ...prev, [mealType]: choice }));
  };

  const handleSubmit = async () => {
    try {
      const dateISO = selectedDate.toISOString().split('T')[0];
      await Promise.all(Object.entries(intents).map(([mealType, choice]) => setMyIntent(dateISO, mealType as any, choice)));
      toast.success('Meal preferences saved!');
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
  };

  // Notify on backend updates (e.g., new menu created)
  useSocketEvent(
    'meals:menu-created',
    (payload: any) => {
      try {
        toast.info(`Menu updated for ${payload?.mealType || 'a meal'}`);
      } catch {}
    },
    true
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Meals</h1>
        <p className="text-muted-foreground">View menu and set meal preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Reply Notification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm mb-2">
              💡 <strong>Tip:</strong> You'll receive daily notifications where you can respond{' '}
              <strong>Yes</strong>, <strong>Same as Yesterday</strong>, or{' '}
              <strong>No</strong> without opening the app!
            </p>
            <p className="text-xs text-muted-foreground">
              If you're outside the hostel during meal time, you'll be automatically excluded from the count.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date: Date | undefined) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Preferences for {selectedDate.toLocaleDateString()}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType) => (
                <div key={mealType} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {getMealIcon(mealType)}
                    <h3 className="font-medium">{mealType}</h3>
                  </div>

                  <RadioGroup
                    value={intents[mealType]}
                    onValueChange={(value: string) => handleIntentChange(mealType, value as MealChoice)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="YES" id={`${mealType}-yes`} />
                      <Label htmlFor={`${mealType}-yes`} className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="SAME" id={`${mealType}-same`} />
                      <Label htmlFor={`${mealType}-same`} className="cursor-pointer">Same as Yesterday</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NO" id={`${mealType}-no`} />
                      <Label htmlFor={`${mealType}-no`} className="cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}

              <Button onClick={handleSubmit} className="w-full">
                <CheckCircle2 className="h-4 w-4" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Menu</CardTitle>
        </CardHeader>
        <CardContent>
          {menus.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No menu available for this date
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {menus.map((menu) => (
                <div key={menu.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {getMealIcon(menu.mealType)}
                    <h3 className="font-medium">{menu.mealType}</h3>
                  </div>
                  <ul className="space-y-1">
                    {(menu.items || []).map((item: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-center gap-2 text-wrap">
                        <span className="text-green-600 dark:text-green-400">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
