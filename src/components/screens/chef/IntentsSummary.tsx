import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Calendar } from '../../ui/calendar';
import { Coffee, Sun, Moon, Download, TrendingUp } from 'lucide-react';
import { exportMealsSummaryCSV } from '../../../lib/api';
import { getIntentsSummary } from '../../../lib/meals';
import { toast } from 'sonner';
import { useSocketEvent } from '../../../lib/socket';

export function IntentsSummary() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [mealIntents, setMealIntents] = useState({
    BREAKFAST: { yes: 0, same: 0, no: 0, outside: 0, noResponse: 0 },
    LUNCH: { yes: 0, same: 0, no: 0, outside: 0, noResponse: 0 },
    DINNER: { yes: 0, same: 0, no: 0, outside: 0, noResponse: 0 },
  });

  async function loadSummary(d: Date) {
    try {
      const iso = d.toISOString().split('T')[0];
      const s = await getIntentsSummary(iso);
      setMealIntents({
        BREAKFAST: { ...s.BREAKFAST, noResponse: 0 },
        LUNCH: { ...s.LUNCH, noResponse: 0 },
        DINNER: { ...s.DINNER, noResponse: 0 },
      });
    } catch (e: any) {
      console.error(e);
    }
  }

  // load on mount and when date changes
  useEffect(() => { loadSummary(selectedDate); }, [selectedDate]);

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

  const totalResponses = (intents: typeof mealIntents.BREAKFAST) => 
    intents.yes + intents.same + intents.no;

  const expectedCount = (intents: typeof mealIntents.BREAKFAST) =>
    intents.yes + intents.same - intents.outside;

  const [downloading, setDownloading] = useState(false);

  const onExport = async () => {
    try {
      setDownloading(true);
      await exportMealsSummaryCSV(selectedDate);
      toast.success('Meals summary CSV downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export meals summary');
    } finally {
      setDownloading(false);
    }
  };

  // Live update listener
  useSocketEvent(
    'meals:intent-updated',
    (payload: any) => {
      try {
        const { mealType, yes, same, no, outside } = payload || {};
        if (!mealType) return;
        setMealIntents((prev: any) => ({
          ...prev,
          [mealType]: {
            ...prev[mealType],
            yes: yes ?? prev[mealType].yes,
            same: same ?? prev[mealType].same,
            no: no ?? prev[mealType].no,
            outside: outside ?? prev[mealType].outside,
          },
        }));
        toast.success(`New intents for ${mealType}`);
      } catch {}
    },
    true
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Meal Intents Summary</h1>
          <p className="text-muted-foreground">View student meal preferences and responses</p>
        </div>
        <Button variant="outline" onClick={onExport} disabled={downloading}>
          <Download className="h-4 w-4" />
          {downloading ? 'Exporting…' : 'Export Report'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">435</div>
            <p className="text-xs text-muted-foreground">96.7% response rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expected Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">425</div>
            <p className="text-xs text-muted-foreground">Across all meals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Auto-Excluded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600 dark:text-orange-400">19</div>
            <p className="text-xs text-muted-foreground">Students outside</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">No Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">25</div>
            <p className="text-xs text-muted-foreground">Need follow-up</p>
          </CardContent>
        </Card>
      </div>

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
              <CardTitle>Intent Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="BREAKFAST">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="BREAKFAST">
                    <Coffee className="h-4 w-4 mr-2" />
                    Breakfast
                  </TabsTrigger>
                  <TabsTrigger value="LUNCH">
                    <Sun className="h-4 w-4 mr-2" />
                    Lunch
                  </TabsTrigger>
                  <TabsTrigger value="DINNER">
                    <Moon className="h-4 w-4 mr-2" />
                    Dinner
                  </TabsTrigger>
                </TabsList>

                {Object.entries(mealIntents).map(([meal, intents]) => (
                  <TabsContent key={meal} value={meal} className="mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                        <p className="text-2xl text-green-600 dark:text-green-400">{intents.yes}</p>
                        <p className="text-xs text-muted-foreground">Yes</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                        <p className="text-2xl text-blue-600 dark:text-blue-400">{intents.same}</p>
                        <p className="text-xs text-muted-foreground">Same</p>
                      </div>
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                        <p className="text-2xl text-orange-600 dark:text-orange-400">{intents.outside}</p>
                        <p className="text-xs text-muted-foreground">Outside</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                        <p className="text-2xl text-red-600 dark:text-red-400">{intents.no}</p>
                        <p className="text-xs text-muted-foreground">No</p>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-accent rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Expected Count</span>
                        <span className="text-2xl">{expectedCount(intents)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Response Rate</span>
                        <span className="font-medium">
                          {((totalResponses(intents) / 450) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Intent Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(mealIntents).map(([meal, intents]) => (
              <div key={meal} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getMealIcon(meal)}
                    <div>
                      <h3 className="font-medium">{meal}</h3>
                      <p className="text-sm text-muted-foreground">
                        Expected: {expectedCount(intents)} (excl. {intents.outside} outside)
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4">
                    {expectedCount(intents)}
                  </Badge>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                  <div>
                    <p className="text-green-600 dark:text-green-400 font-medium">{intents.yes}</p>
                    <p className="text-muted-foreground">Yes</p>
                  </div>
                  <div>
                    <p className="text-blue-600 dark:text-blue-400 font-medium">{intents.same}</p>
                    <p className="text-muted-foreground">Same</p>
                  </div>
                  <div>
                    <p className="text-red-600 dark:text-red-400 font-medium">{intents.no}</p>
                    <p className="text-muted-foreground">No</p>
                  </div>
                  <div>
                    <p className="text-orange-600 dark:text-orange-400 font-medium">{intents.outside}</p>
                    <p className="text-muted-foreground">Outside</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">{intents.noResponse}</p>
                    <p className="text-muted-foreground">No Resp.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Average Response Rate</span>
              <span className="font-medium">96.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Participation Improvement</span>
              <span className="font-medium text-green-600 dark:text-green-400">+3.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Waste Reduction</span>
              <span className="font-medium text-green-600 dark:text-green-400">+12%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
