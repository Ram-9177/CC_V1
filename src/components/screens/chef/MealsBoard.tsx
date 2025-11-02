import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Coffee, Sun, Moon } from 'lucide-react';
import { t } from '../../../lib/i18n';
import { useSocketEvent } from '../../../lib/socket';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { sendMealReminder } from '../../../lib/notificationsClient';
import { getIntentsSummary, listMenus, updateMenu } from '../../../lib/meals';

export function MealsBoard() {
  const today = new Date().toISOString().slice(0,10);
  const [menus, setMenus] = useState<any[]>([]);
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const currentMenu = menus.find(m => m.id === editingMenu) || null;
  const [editItems, setEditItems] = useState<string>('');

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

  const [intentTotals, setIntentTotals] = useState({
    BREAKFAST: { yes: 0, same: 0, no: 0, outside: 0 },
    LUNCH: { yes: 0, same: 0, no: 0, outside: 0 },
    DINNER: { yes: 0, same: 0, no: 0, outside: 0 },
  });

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([
          listMenus(today),
          getIntentsSummary(today),
        ]);
        setMenus(m);
        setIntentTotals(s as any);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load meals');
      }
    })();
  }, []);

  // Live updates from backend: meals:intent-updated
  useSocketEvent(
    'meals:intent-updated',
    (payload: any) => {
      try {
        const { mealType, yes, same, no, outside } = payload || {};
        if (!mealType) return;
  setIntentTotals((prev: any) => ({
          ...prev,
          [mealType]: {
            yes: yes ?? prev[mealType as keyof typeof prev].yes,
            same: same ?? prev[mealType as keyof typeof prev].same,
            no: no ?? prev[mealType as keyof typeof prev].no,
            outside: outside ?? prev[mealType as keyof typeof prev].outside,
          },
        }));
        toast.success(`Updated intents for ${mealType}`);
      } catch {}
    },
    true
  );

  const mockAdjustmentLog = [
    { hallticket: 'HT001', name: 'Ravi Kumar', reason: 'Went OUT at 10:30 AM', meal: 'LUNCH', impact: -1 },
    { hallticket: 'HT003', name: 'Anil Reddy', reason: 'Returned IN at 11:00 AM', meal: 'LUNCH', impact: +1 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Meals Board</h1>
        <p className="text-muted-foreground">Manage daily menus and view meal intents</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today's Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">425</div>
            <p className="text-xs text-muted-foreground">Across all meals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Students Outside</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600 dark:text-orange-400">19</div>
            <p className="text-xs text-muted-foreground">Auto-excluded from count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Opted Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">9</div>
            <p className="text-xs text-muted-foreground">Manually declined</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Menu & Intents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {menus.map((menu) => {
              const intents = intentTotals[menu.mealType as keyof typeof intentTotals];
              const totalIntents = intents.yes + intents.same;
              const actualCount = totalIntents - intents.outside;

              return (
                <div key={menu.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-3">
                      {getMealIcon(menu.mealType)}
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          {menu.mealType}
                          {menu.closed ? (
                            <Badge variant="destructive">Closed</Badge>
                          ) : null}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Expected: {actualCount} (excl. {intents.outside} outside)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingMenu(menu.id); setEditItems((menu.items || []).join('\n')); }}
                      >
                        Edit Menu
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await sendMealReminder({ mealType: menu.mealType, hostelId: (menu as any).hostelId, date: menu.date });
                            if ((res as any)?.skipped === 'holiday') {
                              toast.info('Skipped: today is a holiday');
                            } else {
                              toast.success('Meal reminder sent');
                            }
                          } catch {
                            toast.error('Failed to send reminder');
                          }
                        }}
                      >
                        Send Reminder
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                      <p className="text-2xl text-green-600 dark:text-green-400">{intents.yes}</p>
                      <p className="text-xs text-muted-foreground">Yes</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-2xl text-blue-600 dark:text-blue-400">{intents.same}</p>
                      <p className="text-xs text-muted-foreground">Same</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                      <p className="text-2xl text-orange-600 dark:text-orange-400">{intents.outside}</p>
                      <p className="text-xs text-muted-foreground">Outside</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                      <p className="text-2xl text-red-600 dark:text-red-400">{intents.no}</p>
                      <p className="text-xs text-muted-foreground">No</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(menu.items || []).map((item: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adjustment Log (IN/OUT Changes)</CardTitle>
        </CardHeader>
        <CardContent>
          {mockAdjustmentLog.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No adjustments today</p>
          ) : (
            <div className="space-y-2">
              {mockAdjustmentLog.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{log.hallticket}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{log.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{log.reason}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{log.meal}</Badge>
                    <p className={`text-sm font-medium mt-1 ${log.impact > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {log.impact > 0 ? '+' : ''}{log.impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingMenu} onOpenChange={() => setEditingMenu(null)}>
        <DialogContent className="sm:max-w-lg">
          {currentMenu && (
            <>
              <DialogHeader>
                <DialogTitle>Edit {currentMenu.mealType} Items</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter one item per line.</p>
                <Textarea rows={8} value={editItems} onChange={(e) => setEditItems(e.target.value)} />
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingMenu(null)}>Cancel</Button>
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const items = editItems.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                        await updateMenu(currentMenu.id, items);
                        setMenus(prev => prev.map(m => m.id === currentMenu.id ? { ...m, items } : m));
                        toast.success('Menu updated');
                        setEditingMenu(null);
                      } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
