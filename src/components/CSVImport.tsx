import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Upload, Download, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { t } from '../lib/i18n';

// Backend-expected CSV headers for bulk import
// hallticket,firstName,lastName,phoneNumber,email,roomNumber,hostelBlock,role,password
interface CSVRow {
  hallticket: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
  roomNumber?: string;
  hostelBlock?: string;
  role?: string;
  password?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface CSVImportProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: CSVRow[]) => Promise<void>;
  canAssignStaffRoles?: boolean;
}

export function CSVImport({ open, onClose, onImport, canAssignStaffRoles = false }: CSVImportProps) {
  const [step, setStep] = useState<'upload' | 'validate' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [progress, setProgress] = useState(0);

  const downloadTemplate = () => {
    const template = [
      'hallticket,firstName,lastName,phoneNumber,email,roomNumber,hostelBlock,role,password',
      'HT001,Ravi,Kumar,9876543210,ravi@example.com,101,Block A,STUDENT,changeme123',
      'WARDEN001,Ramesh,Varma,9876543201,ramesh@example.com,,Block A,WARDEN,changeme123'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_template.csv';
    a.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStep('validate');

    // Parse CSV (simplified)
    const text = await selectedFile.text();
    const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
    
    const parsedData: CSVRow[] = [];
    const validationErrors: ValidationError[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      // Normalize to backend schema keys if different header names are used
      const normalized: CSVRow = {
        hallticket: (row['hallticket'] || row['Hall Ticket'] || '').toString().trim().toUpperCase(),
        firstName: (row['firstName'] || row['First Name'] || row['Name']?.split(' ')?.[0] || '').toString().trim(),
        lastName: (row['lastName'] || row['Last Name'] || row['Name']?.split(' ')?.slice(1).join(' ') || '').toString().trim(),
        phoneNumber: (row['phoneNumber'] || row['Phone'] || row['Number'] || '').toString().trim(),
        email: (row['email'] || row['Email'] || '').toString().trim().toLowerCase(),
        roomNumber: (row['roomNumber'] || row['Room'] || row['room'] || '').toString().trim(),
        hostelBlock: (row['hostelBlock'] || row['Hostel'] || row['Hostel Name'] || '').toString().trim(),
        role: (row['role'] || row['Role'] || '').toString().trim().toUpperCase().replace(/[-\s]/g, '_'),
        password: (row['password'] || row['Password'] || '').toString()
      };

      // Validate minimal requirements
      if (!normalized.hallticket) {
        validationErrors.push({ row: i, field: 'hallticket', message: 'hallticket is required' });
      }
      if (!normalized.firstName) {
        validationErrors.push({ row: i, field: 'firstName', message: 'firstName is required' });
      }
      if (!normalized.lastName) {
        validationErrors.push({ row: i, field: 'lastName', message: 'lastName is required' });
      }

      parsedData.push(normalized as CSVRow);
    }

    setData(parsedData);
    setErrors(validationErrors);
    setStep('preview');
  };

  const handleImport = async () => {
    if (errors.length > 0) return;

    setStep('importing');
    setProgress(0);

    // Simulate import progress
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await onImport(data);
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setData([]);
    setErrors([]);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('import')} Users via CSV</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required Columns:</strong> hallticket, firstName, lastName
                <div className="mt-2 text-sm text-muted-foreground">
                  Optional: phoneNumber, email, roomNumber, hostelBlock, password{canAssignStaffRoles ? ', role (STUDENT|WARDEN|WARDEN_HEAD|GATEMAN|CHEF|SUPER_ADMIN)' : ''}
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button variant="outline" onClick={downloadTemplate} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>

              <label className="flex-1">
                <Button className="w-full" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload CSV
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Found {errors.length} validation errors. Please fix and re-upload.
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}, {err.field}: {err.message}
                      </li>
                    ))}
                    {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {errors.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {data.length} rows ready to import. No validation errors found.
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>hallticket</TableHead>
                    <TableHead>firstName</TableHead>
                    <TableHead>lastName</TableHead>
                    <TableHead>phoneNumber</TableHead>
                    <TableHead>roomNumber</TableHead>
                    <TableHead>hostelBlock</TableHead>
                    <TableHead>role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 20).map((row, idx) => {
                    const rowErrors = errors.filter(e => e.row === idx + 1);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{row.hallticket}</TableCell>
                        <TableCell>{row.firstName}</TableCell>
                        <TableCell>{row.lastName}</TableCell>
                        <TableCell>{row.phoneNumber || ''}</TableCell>
                        <TableCell>{row.roomNumber || ''}</TableCell>
                        <TableCell>{row.hostelBlock || ''}</TableCell>
                        <TableCell>{row.role || 'STUDENT'}</TableCell>
                        <TableCell>
                          {rowErrors.length > 0 ? (
                            <Badge variant="destructive">Error</Badge>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        ...and {data.length - 20} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p>Importing {data.length} users...</p>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">{t('success')}!</h3>
              <p className="text-muted-foreground">Successfully imported {data.length} users</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              {t('cancel')}
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={errors.length > 0}>
                {t('import')} {data.length} Users
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
