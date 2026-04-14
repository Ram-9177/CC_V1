import { useMemo } from 'react';
import { Download, Copy, Check, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface UploadResult {
  success: boolean;
  message: string;
  created: number;
  failed: number;
  created_rows: number[];
  failed_rows: number[];
  errors: Array<{ line?: number; row?: number; error: string; username?: string }>;
  generated_passwords: Array<{ username: string; password: string; email: string }>;
}

interface UploadResultsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  result: UploadResult | null;
  fileName?: string;
}

export function UploadResultsModal({ isOpen, onOpenChange, result, fileName }: UploadResultsModalProps) {
  if (!result) return null;

  const rowKey = result.failed_rows.length > 0 && result.errors.length > 0
    ? (result.errors[0].line !== undefined ? 'line' : 'row')
    : 'line';

  const errorsByRow = useMemo(() => {
    const map = new Map<number, string>();
    result.errors.forEach(err => {
      const rowNum = err[rowKey as keyof typeof err] as number;
      if (rowNum) map.set(rowNum, err.error);
    });
    return map;
  }, [result.errors, rowKey]);

  const downloadFailedRows = () => {
    if (result.failed_rows.length === 0) {
      toast.info('No failed rows to download');
      return;
    }

    const csv = [
      'Row Number,Error Reason',
      ...result.failed_rows.map(row => {
        const error = errorsByRow.get(row) || 'Unknown error';
        return `${row},"${error.replace(/"/g, '""')}"`;
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed-rows-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Failed rows file downloaded');
  };

  const downloadPasswords = () => {
    if (result.generated_passwords.length === 0) {
      toast.info('No passwords to download');
      return;
    }

    const csv = [
      'Username,Password,Email',
      ...result.generated_passwords.map(cred =>
        `${cred.username},"${cred.password}",${cred.email}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credentials-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Credentials file downloaded');
  };

  const copyCreatedRows = () => {
    const text = result.created_rows.join(', ');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyFailedRows = () => {
    const text = result.failed_rows.join(', ');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {result.success ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-6 w-6" />
                Upload Complete
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <XCircle className="h-6 w-6" />
                Upload Failed
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary */}
          <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10">
            <div className="space-y-3">
              <div className="text-lg font-semibold">{result.message}</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Rows</div>
                  <div className="text-2xl font-bold">{result.created + result.failed}</div>
                </div>
                <div className="text-green-600">
                  <div className="text-muted-foreground">Created ✓</div>
                  <div className="text-2xl font-bold">{result.created}</div>
                </div>
                <div className="text-red-600">
                  <div className="text-muted-foreground">Failed ✗</div>
                  <div className="text-2xl font-bold">{result.failed}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Tabs for Created/Failed/Credentials */}
          <Tabs defaultValue="created" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="created">
                Created Rows ({result.created})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed Rows ({result.failed})
              </TabsTrigger>
              <TabsTrigger value="credentials">
                Credentials ({result.generated_passwords.length})
              </TabsTrigger>
            </TabsList>

            {/* Created Rows */}
            <TabsContent value="created" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {result.created_rows.length === 0
                      ? 'No rows were successfully created'
                      : `${result.created_rows.length} rows created successfully`}
                  </div>
                  {result.created_rows.length > 0 && (
                    <>
                      <div className="max-h-48 overflow-y-auto p-3 bg-secondary rounded border border-border">
                        <div className="text-sm font-mono text-muted-foreground break-words">
                          {result.created_rows.join(', ')}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyCreatedRows}
                        className="gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy Row Numbers
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* Failed Rows */}
            <TabsContent value="failed" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {result.failed_rows.length === 0
                      ? 'No failures'
                      : `${result.failed_rows.length} rows failed`}
                  </div>
                  {result.failed_rows.length > 0 && (
                    <>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {result.failed_rows.slice(0, 20).map(row => {
                          const error = errorsByRow.get(row);
                          return (
                            <div key={row} className="p-2 bg-red-50 rounded border border-red-200">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="font-semibold text-red-900">Row {row}:</span>
                                  <p className="text-sm text-red-800">{error}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {result.failed_rows.length > 20 && (
                          <div className="p-2 text-sm text-muted-foreground">
                            ... and {result.failed_rows.length - 20} more errors
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyFailedRows}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Row Numbers
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadFailedRows}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download Failed Rows
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* Credentials */}
            <TabsContent value="credentials" className="space-y-4">
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {result.generated_passwords.length === 0
                      ? 'No credentials generated'
                      : `${result.generated_passwords.length} users created with default passwords`}
                  </div>
                  {result.generated_passwords.length > 0 && (
                    <>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {result.generated_passwords.slice(0, 20).map(cred => (
                          <div key={cred.username} className="p-2 bg-blue-50 rounded border border-blue-200">
                            <div className="text-sm font-mono">
                              <div><span className="font-semibold">Username:</span> {cred.username}</div>
                              <div><span className="font-semibold">Password:</span> {cred.password}</div>
                              <div><span className="font-semibold">Email:</span> {cred.email}</div>
                            </div>
                          </div>
                        ))}
                        {result.generated_passwords.length > 20 && (
                          <div className="p-2 text-sm text-muted-foreground">
                            ... and {result.generated_passwords.length - 20} more
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadPasswords}
                        className="gap-2 w-full"
                      >
                        <Download className="h-4 w-4" />
                        Download Credentials CSV
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Tips */}
          {result.failed > 0 && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="text-sm space-y-2">
                <div className="font-semibold text-amber-900">How to fix and retry:</div>
                <ul className="list-disc list-inside text-amber-900 space-y-1">
                  <li>Download the failed rows file above</li>
                  <li>Fix the errors in your CSV editor</li>
                  <li>Re-upload the corrected file</li>
                  <li>Only the corrected rows will be processed again</li>
                </ul>
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="min-w-[120px]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
