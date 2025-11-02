import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { CSVImport } from '../../CSVImport';
import { Upload, Download, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../lib/context';
import { bulkImportUsersFromCsvText, exportUsers as apiExportUsers } from '../../../lib/users';

export function UsersCSV() {
  const [importedData, setImportedData] = useState<any[]>([]);
  const [showImport, setShowImport] = useState(false);
  const { role } = useAuth();

  const handleImportData = async (data: any[]) => {
    // Build CSV text in backend-expected format
    const header = ['hallticket','firstName','lastName','phoneNumber','email','roomNumber','hostelBlock','role','password'];
    const rows = data.map((r: any) => [
      (r.hallticket || '').toString().trim().toUpperCase(),
      r.firstName || '',
      r.lastName || '',
      (r.phoneNumber || '').toString().trim(),
      (r.email || '').toString().trim().toLowerCase(),
      r.roomNumber || '',
      r.hostelBlock || '',
      ((r.role || 'STUDENT').toString().trim().toUpperCase().replace(/[-\s]/g, '_')),
      r.password || 'changeme123',
    ]);
    const csv = [header.join(','), ...rows.map((arr) => arr.map((v) => String(v).replace(/\n/g,' ')).join(','))].join('\n');
    const result = await bulkImportUsersFromCsvText(csv);
    setImportedData(data);
    setShowImport(false);
    return result;
  };

  const handleExport = async () => {
    try {
      const csvContent = await apiExportUsers({ role: 'STUDENT' });
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'users_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Student Management (CSV)</h1>
          <p className="text-muted-foreground">Import and export student data</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">450</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">445</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">5</div>
          </CardContent>
        </Card>
      </div>

      {!showImport ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setShowImport(true)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
                  <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                Import Users (CSV)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Upload a CSV file to bulk import users. Wardens can import Students; Warden Head can also import Wardens.
              </p>
              <Button className="w-full">
                <Upload className="h-4 w-4" />
                Start Import
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={handleExport}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded-lg">
                  <Download className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                Export Students (CSV)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Download all student data as a CSV file. Useful for backups and external analysis.
              </p>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Modal-based CSV import wizard */}
      <CSVImport
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImportData as any}
        canAssignStaffRoles={role === 'SUPER_ADMIN' || role === 'WARDEN_HEAD'}
      />

      {importedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium">Import Successful</p>
                  <p className="text-sm text-muted-foreground">
                    {importedData.length} students imported successfully
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm">Hall Ticket</th>
                      <th className="text-left p-3 text-sm">Name</th>
                      <th className="text-left p-3 text-sm">Phone</th>
                      <th className="text-left p-3 text-sm">Room</th>
                      <th className="text-left p-3 text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3 text-sm">{row.hallticket || '-'}</td>
                        <td className="p-3 text-sm">{row.name || '-'}</td>
                        <td className="p-3 text-sm">{row.phone || '-'}</td>
                        <td className="p-3 text-sm">{row.room || '-'}</td>
                        <td className="p-3 text-sm">
                          <Badge variant="default">Imported</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>CSV Format Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm mb-2"><strong>Required Columns:</strong></p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">hallticket</code> - Unique identifier</li>
                <li>• <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">firstName</code> and <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">lastName</code></li>
                <li>• Optional: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">phoneNumber</code>, <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">email</code>, <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">roomNumber</code>, <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">hostelBlock</code>, <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">password</code></li>
                <li>• If allowed, <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">role</code> can be set to STUDENT | WARDEN | WARDEN_HEAD | GATEMAN | CHEF | SUPER_ADMIN</li>
              </ul>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium mb-1">Important Notes:</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Ensure hall ticket numbers are unique</li>
                    <li>• Phone numbers should be 10 digits</li>
                    <li>• CSV file should use UTF-8 encoding</li>
                    <li>• Maximum 1000 records per import</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
