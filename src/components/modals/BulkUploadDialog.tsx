import React, { useState, useRef } from 'react';
import { Download, Upload, AlertCircle, CheckCircle2, Loader, X, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface BulkUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (data: any) => void;
}

interface ValidationResult {
  valid: boolean;
  summary: {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
  };
  errors: Array<{ line: number; error: string }>;
  message: string;
}

export function BulkUploadDialog({ isOpen, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const currentUser = useAuthStore((state: any) => state.user);
  const [uploadType, setUploadType] = useState<'students' | 'staff'>('students');
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tenant context for college admins/wardens
  const isTenantRestricted = currentUser?.role === 'admin' || currentUser?.role === 'warden';
  const userCollege = typeof currentUser?.college === 'object' ? currentUser.college : null;
  const userCollegeName = userCollege?.name || currentUser?.college_name || '';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setValidation(null);
    }
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setIsValidating(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = uploadType === 'students' 
        ? '/users/tenants/validate-csv/' 
        : '/auth/users/validate-csv/';
      const { data } = await api.post(endpoint, formData);
      setValidation(data);

      if (data.errors.length > 0) {
        // Check for tenant-specific errors
        const tenantErrors = data.errors.filter((e: any) => 
          e.error?.toLowerCase().includes('unauthorized college') ||
          e.error?.toLowerCase().includes('college code') ||
          e.error?.toLowerCase().includes('tenant')
        );
        
        if (tenantErrors.length > 0) {
          toast.error(`⚠️ Tenant violation detected! You can only upload for ${userCollegeName || 'your college'}`);
        } else {
          toast.warning(`${data.errors.length} validation errors found. Review before uploading.`);
        }
      } else {
        toast.success('✓ All rows valid for your college!');
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || 'Validation failed';
      if (errorMsg.includes('unauthorized') || errorMsg.includes('college')) {
        toast.error(`🔒 You can only upload for ${userCollegeName}`);
      } else {
        toast.error(errorMsg);
      }
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    // Check for tenant-specific errors before upload
    if (validation && validation.errors.length > 0) {
      const tenantErrors = validation.errors.filter((e: any) => 
        e.error?.toLowerCase().includes('unauthorized college') ||
        e.error?.toLowerCase().includes('college code') ||
        e.error?.toLowerCase().includes('tenant')
      );
      
      if (tenantErrors.length > 0) {
        toast.error(`Cannot upload: ${tenantErrors[0].error}`);
        return;
      }

      const confirmed = window.confirm(
        `${validation.errors.length} errors found. Upload anyway? Only valid rows will be created.`
      );
      if (!confirmed) return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = uploadType === 'students' 
        ? '/users/tenants/bulk_upload/' 
        : '/auth/users/bulk_upload/';
      const { data } = await api.post(endpoint, formData);
      
      onSuccess?.(data);
      toast.success(data.message || '✓ Upload completed successfully');
      
      // Reset form
      setFile(null);
      setValidation(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onOpenChange(false);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.response?.data?.error || error?.message || 'Upload failed';
      
      // Handle tenant isolation errors specially
      if (errorMsg.includes('unauthorized') || errorMsg.includes('college') || errorMsg.includes('tenant')) {
        toast.error(`🔒 ${errorMsg}`);
      } else {
        toast.error(`Upload failed: ${errorMsg}`);
      }
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/users/tenants/download-template/';
  };

  const handleClose = () => {
    setFile(null);
    setValidation(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Users</DialogTitle>
          <DialogDescription>
            Upload students or staff in bulk via CSV file. Validate before uploading to catch errors early.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* TENANT ISOLATION WARNING - College Admins & Wardens Only */}
          {isTenantRestricted && (
            <Card className="p-4 border-l-4 border-l-blue-600 bg-blue-50">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-blue-900">Tenant Context Locked</div>
                  <div className="text-sm text-blue-800 mt-1">
                    You can only upload data for <span className="font-bold">{userCollegeName || 'your college'}</span>
                  </div>
                  <div className="text-xs text-blue-700 mt-2">
                    ✓ Strict tenant isolation enforced — your data will not mix with other colleges
                  </div>
                </div>
              </div>
            </Card>
          )}
          {/* Role Selection */}
          <fieldset className="space-y-4">
            <legend className="text-base font-semibold">What would you like to upload?</legend>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setUploadType('students');
                  setFile(null);
                  setValidation(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                aria-pressed={uploadType === 'students'}
                className={`w-full text-left p-3 border rounded-lg cursor-pointer transition-all ${
                  uploadType === 'students'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                <div className="font-semibold">Upload Students</div>
                <div className="text-sm text-muted-foreground">
                  CSV with student details (father/mother, address, etc.)
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadType('staff');
                  setFile(null);
                  setValidation(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                aria-pressed={uploadType === 'staff'}
                className={`w-full text-left p-3 border rounded-lg cursor-pointer transition-all ${
                  uploadType === 'staff'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                <div className="font-semibold">Upload Staff/Admins</div>
                <div className="text-sm text-muted-foreground">
                  CSV with staff, wardens, admins, and other roles
                </div>
              </button>
            </div>
          </fieldset>

          {/* File Selection */}
          <Card className="p-4 border-2 border-dashed border-border">
            <div className="text-center space-y-2">
              {file ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div className="text-left">
                      <div className="font-semibold">{file.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setValidation(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <Label htmlFor="file-input" className="cursor-pointer">
                      <span className="font-semibold text-primary hover:underline">Click to upload</span>
                      {' '}or drag and drop
                    </Label>
                    <Input
                      id="file-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      ref={fileInputRef}
                      className="hidden"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">CSV files only, max 500 rows</div>
                </>
              )}
            </div>
          </Card>

          {/* Validation Results */}
          {validation && (() => {
            const tenantErrors = validation.errors.filter((e: any) => 
              e.error?.toLowerCase().includes('unauthorized college') ||
              e.error?.toLowerCase().includes('college code') ||
              e.error?.toLowerCase().includes('tenant')
            );
            const hasTenantIssues = tenantErrors.length > 0;
            
            return (
              <Card className={`p-4 border-l-4 ${
                hasTenantIssues 
                  ? 'border-l-red-600 bg-red-50' 
                  : validation.valid 
                    ? 'border-l-green-600 bg-green-50' 
                    : 'border-l-orange-600 bg-orange-50'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    {hasTenantIssues ? (
                      <Lock className="h-5 w-5 text-red-600 mt-0.5" />
                    ) : validation.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className={`font-semibold ${hasTenantIssues ? 'text-red-700' : ''}`}>
                        {hasTenantIssues ? '🔒 Tenant Violation Detected' : validation.message}
                      </div>
                      <div className={`text-sm mt-1 ${hasTenantIssues ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {hasTenantIssues 
                          ? `Some rows reference colleges outside your scope. You can only upload for "${userCollegeName || 'your college'}".`
                          : `Total rows: ${validation.summary.total_rows} | Valid: ${validation.summary.valid_rows} | Invalid: ${validation.summary.invalid_rows}`
                        }
                      </div>
                    </div>
                  </div>

                  {validation.errors.length > 0 && (
                    <div className="space-y-2">
                      {hasTenantIssues && (
                        <div className="p-3 bg-red-100 border border-red-300 rounded text-sm text-red-700 font-medium">
                          ⚠️ {tenantErrors.length} tenant violation(s) found. Cannot proceed with upload.
                        </div>
                      )}
                      <div className="text-sm font-semibold">Errors:</div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {validation.errors.slice(0, 10).map((err, idx) => {
                          const isTenantError = err.error?.toLowerCase().includes('unauthorized college') ||
                                                err.error?.toLowerCase().includes('college code') ||
                                                err.error?.toLowerCase().includes('tenant');
                          return (
                            <div 
                              key={idx} 
                              className={`text-xs p-2 rounded border ${
                                isTenantError 
                                  ? 'bg-red-100 border-red-300 text-red-700' 
                                  : 'bg-white border-border'
                              }`}
                            >
                              <span className="font-semibold">Row {err.line}:</span> {err.error}
                              {isTenantError && <span className="ml-1">🔒</span>}
                            </div>
                          );
                        })}
                        {validation.errors.length > 10 && (
                          <div className="text-xs text-muted-foreground p-2">
                            ... and {validation.errors.length - 10} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>

            <Button
              variant={validation ? 'outline' : 'default'}
              onClick={handleValidate}
              disabled={!file || isValidating || isUploading}
              className="gap-2"
            >
              {isValidating && <Loader className="h-4 w-4 animate-spin" />}
              {isValidating ? 'Validating...' : 'Validate Before Upload'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          {(() => {
            const tenantErrors = validation?.errors.filter((e: any) => 
              e.error?.toLowerCase().includes('unauthorized college') ||
              e.error?.toLowerCase().includes('college code') ||
              e.error?.toLowerCase().includes('tenant')
            ) || [];
            const hasTenantIssues = tenantErrors.length > 0;
            
            return (
              <Button
                onClick={handleUpload}
                disabled={!file || isValidating || isUploading || hasTenantIssues}
                className="gap-2"
                title={hasTenantIssues ? '🔒 Cannot upload: Tenant violations detected' : ''}
              >
                {isUploading && <Loader className="h-4 w-4 animate-spin" />}
                {isUploading ? 'Uploading...' : hasTenantIssues ? '🔒 Fix Tenant Issues' : 'Upload CSV'}
              </Button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
