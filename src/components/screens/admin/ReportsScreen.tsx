import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Calendar } from '../../ui/calendar';
import { Download, FileText, BarChart3, TrendingUp, Users, Clock } from 'lucide-react';
import { useState } from 'react';

export function ReportsScreen() {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const reportTypes = [
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Detailed attendance records with analytics',
      icon: Users,
      color: 'blue',
    },
    {
      id: 'gatepasses',
      title: 'Gate Pass Report',
      description: 'Entry/exit activity and gate pass statistics',
      icon: FileText,
      color: 'green',
    },
    {
      id: 'meals',
      title: 'Meals Report',
      description: 'Meal participation and intent analysis',
      icon: BarChart3,
      color: 'orange',
    },
    {
      id: 'analytics',
      title: 'Analytics Dashboard',
      description: 'Comprehensive system analytics',
      icon: TrendingUp,
      color: 'purple',
    },
  ];

  const recentReports = [
    { name: 'Attendance October 2025', type: 'Attendance', date: '2025-10-31', size: '2.3 MB' },
    { name: 'Gate Pass Weekly Summary', type: 'Gate Pass', date: '2025-10-30', size: '1.8 MB' },
    { name: 'Meals Analytics Q3', type: 'Meals', date: '2025-10-28', size: '3.1 MB' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Reports & Analytics</h1>
          <p className="text-muted-foreground">Generate and download system reports</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">127</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600 dark:text-blue-400">23</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">45.7 GB</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">2 hours ago</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate New Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Type</label>
                <Select defaultValue="attendance">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance Report</SelectItem>
                    <SelectItem value="gatepasses">Gate Pass Report</SelectItem>
                    <SelectItem value="meals">Meals Report</SelectItem>
                    <SelectItem value="analytics">Analytics Dashboard</SelectItem>
                    <SelectItem value="custom">Custom Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Time Period</label>
                <Select defaultValue="thismonth">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="thisweek">This Week</SelectItem>
                    <SelectItem value="lastweek">Last Week</SelectItem>
                    <SelectItem value="thismonth">This Month</SelectItem>
                    <SelectItem value="lastmonth">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <Select defaultValue="csv">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full">
                <Download className="h-4 w-4" />
                Generate Report
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Custom Date Range</label>
              <div className="grid gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Start Date</p>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    className="rounded-md border"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map((report) => (
          <Card key={report.id} className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className={`bg-${report.color}-100 dark:bg-${report.color}-900/20 p-2 rounded-lg`}>
                  <report.icon className={`h-6 w-6 text-${report.color}-600 dark:text-${report.color}-400`} />
                </div>
                {report.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{report.description}</p>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4" />
                Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentReports.map((report, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.type} • {report.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{report.size}</span>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
