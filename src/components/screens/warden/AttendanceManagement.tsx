import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as ConfirmContent,
  AlertDialogDescription,
  AlertDialogFooter as ConfirmFooter,
  AlertDialogHeader as ConfirmHeader,
  AlertDialogTitle as ConfirmTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Download, Plus, Users } from 'lucide-react';
import { t } from '../../../lib/i18n';
import { Analytics, PeriodType } from '../../Analytics';
import { createSession, exportCsv, listSessions, startSession, endSession, getSession, markAttendance, listSessionRecords, exportSessionRecords, exportSessions } from '../../../lib/attendance';
import { Input } from '../../ui/input';
import { useSocketEvent } from '../../../lib/socket';
import { toast } from 'sonner';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../../ui/pagination';
import { listRooms } from '../../../lib/rooms';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Session {
  id: string;
  scope: 'FLOOR' | 'BLOCK' | 'ROOM';
  scopeName: string;
  date: string;
  status: 'ACTIVE' | 'CLOSED';
  presentCount: number;
  absentCount: number;
  lateCount: number;
  rawStatus?: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export function AttendanceManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sessions');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<PeriodType>('WEEK');
  const [selectedScope, setSelectedScope] = useState<'FLOOR' | 'BLOCK' | 'ROOM'>('FLOOR');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrTitle, setQrTitle] = useState<string>('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<any | null>(null);
  const [detailsPage, setDetailsPage] = useState(1);
  const detailsPageSize = 10;
  const [detailsFilterStatus, setDetailsFilterStatus] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('ALL');
  const [detailsFilterSearch, setDetailsFilterSearch] = useState('');
  const [marking, setMarking] = useState(false);
  const [markStudentId, setMarkStudentId] = useState('');
  const [markStatus, setMarkStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt'|'scheduledAt'|'status'|'title'>('createdAt');
  const [sortDir, setSortDir] = useState<'ASC'|'DESC'>('DESC');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Rooms for Room-wise chart / planner
  const [roomsData, setRoomsData] = useState<Array<{ name: string; occupied: number; capacity: number }>>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const refresh = async (opts?: { page?: number }) => {
    try {
      setLoading(true);
  const params: any = { page: opts?.page ?? page, pageSize, sortBy, sortDir };
      if (filterStatus && filterStatus !== 'ALL') params.status = filterStatus;
      if (filterDate) params.date = filterDate;
      if (filterSearch) params.search = filterSearch.trim();
      const res = await listSessions(params);
      const mapped: Session[] = (res.data || []).map((s: any) => ({
        id: s.id,
        scope: 'FLOOR', // unknown at backend; default label
        scopeName: s.title,
        date: s.scheduledAt || s.createdAt,
        status: s.status === 'COMPLETED' ? 'CLOSED' : 'ACTIVE',
        presentCount: s.totalPresent || 0,
        absentCount: s.totalAbsent || Math.max(0, (s.totalExpected || 0) - (s.totalPresent || 0)),
        lateCount: 0,
        rawStatus: s.status,
      }));
      setSessions(mapped);
      setSessionsTotal((res as any).total || mapped.length);
      if (opts?.page) setPage(opts.page);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    // Preload rooms for Blueprint tab visualizations
    const loadRooms = async () => {
      try {
        setRoomsLoading(true);
        const rooms = await listRooms();
        const data = rooms.map((r) => ({
          name: `${r.block}-${r.number}`,
          occupied: Math.max(0, r.occupants ?? 0),
          capacity: Math.max(0, r.capacity ?? 0),
        }));
        setRoomsData(data);
      } catch (e) {
        // non-fatal
      } finally {
        setRoomsLoading(false);
      }
    };
    loadRooms();
  }, []);

  // Optionally re-fetch when filters change automatically
  useEffect(() => {
    refresh({ page: 1 });
  }, [filterStatus, filterDate, filterSearch, sortBy, sortDir]);

  useSocketEvent('attendance:session-started', () => refresh(), true);
  useSocketEvent('attendance:session-ended', (payload?: any) => {
    refresh();
    if (detailsOpen && details?.id && payload?.sessionId === details.id) {
      loadDetails(details.id);
    }
  }, true);
  useSocketEvent('attendance:marked', () => { refresh(); if (detailsOpen && details?.id) loadDetails(details.id); }, true);

  const handleCreateSession = async () => {
    try {
      const title = `${selectedScope} Session ${new Date().toLocaleString()}`;
      await createSession({ title, mode: 'MIXED', scheduledAt: new Date().toISOString() });
      setShowCreateDialog(false);
      refresh();
      toast.success('Session created');
    } catch (e) {
      console.error(e);
      setShowCreateDialog(false);
      toast.error('Failed to create session');
    }
  };

  const handleExportCSV = async () => {
    try {
      if (!sessions.length) return;
      // Export latest session for convenience
      const sid = sessions[0].id;
      const csv = await exportCsv(sid);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${sid}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export CSV');
    }
  };

  const handleExportSessionsPage = async () => {
    try {
      if (!sessions.length) return;
      const header = ['id','title','status','scheduledAt','createdAt','present','absent'];
      // We don't have createdAt in mapped Session; derive from date (scheduled or created)
      const rows = sessions.map((s: any) => [
        s.id,
        s.scopeName,
        s.rawStatus || s.status,
        s.date || '',
        s.date || '',
        String(s.presentCount ?? 0),
        String(s.absentCount ?? 0)
      ]);
      const csv = [header.join(','), ...rows.map(r => r.map((v) => '"' + String(v ?? '').replace(/"/g,'""') + '"').join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sessions-page-${page}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sessions page exported');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export sessions page');
    }
  };

  const handleExportSessionsFilteredAll = async () => {
    try {
      const params: any = { page: 1, pageSize, sortBy, sortDir };
      if (filterStatus && filterStatus !== 'ALL') params.status = filterStatus;
      if (filterDate) params.date = filterDate;
      if (filterSearch) params.search = filterSearch.trim();
      const header = ['id','title','status','scheduledAt','createdAt','present','absent'];
      const rows: string[] = [];
      let current = 1;
      let totalPagesLocal = 1;
      do {
        const res = await listSessions({ ...params, page: current });
        const mapped: any[] = (res.data || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          scheduledAt: s.scheduledAt || '',
          createdAt: s.createdAt || '',
          present: s.totalPresent || 0,
          absent: s.totalAbsent || Math.max(0, (s.totalExpected || 0) - (s.totalPresent || 0))
        }));
        mapped.forEach((m) => {
          const rowArr = [m.id, m.title, m.status, m.scheduledAt, m.createdAt, String(m.present), String(m.absent)];
          rows.push(rowArr.map((v) => '"' + String(v ?? '').replace(/"/g,'""') + '"').join(','));
        });
        const total = (res as any).total || mapped.length;
        totalPagesLocal = Math.max(1, Math.ceil(total / pageSize));
        current += 1;
      } while (current <= totalPagesLocal);
      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sessions-filtered-all.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported all filtered sessions');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export all sessions');
    }
  };

  const handleExportSessionsServer = async (scope: 'page' | 'filtered-all') => {
    try {
      const params: any = { sortBy, sortDir };
      if (filterStatus && filterStatus !== 'ALL') params.status = filterStatus;
      if (filterDate) params.date = filterDate;
      if (filterSearch) params.search = filterSearch.trim();
      if (scope === 'page') {
        params.page = page;
        params.pageSize = pageSize;
      }
      const csv = await exportSessions(params);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = scope === 'page' ? `sessions-page-${page}.csv` : 'sessions-filtered.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sessions exported');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export sessions');
    }
  };

  const openDetails = async (id: string) => {
    await loadDetails(id);
    setDetailsOpen(true);
    setDetailsPage(1);
    setDetailsFilterStatus('ALL');
    setDetailsFilterSearch('');
  };

  const loadDetails = async (id: string) => {
    try {
      const s = await getSession(id);
      setDetails(s);
    } catch (e) { console.error(e); }
  };

  const handleManualMark = async () => {
    if (!details?.id) return;
    try {
      setMarking(true);
      const res: any = await markAttendance({ sessionId: details.id, studentId: markStudentId.trim(), status: markStatus, method: 'MANUAL' });
      setMarkStudentId('');
      if (res && res.queued) {
        toast.success('Offline: queued for sync');
      } else {
        await loadDetails(details.id);
        toast.success('Attendance marked');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startSession(id);
      refresh();
      toast.success('Session started');
    } catch (e) {
      console.error(e);
      toast.error('Failed to start session');
    }
  };

  const handleEnd = async (id: string) => {
    try {
      await endSession(id);
      refresh();
      toast.success('Session ended');
    } catch (e) {
      console.error(e);
      toast.error('Failed to end session');
    }
  };

  const handleViewQr = async (id: string) => {
    try {
      const s: any = await getSession(id);
      if (s?.qrCode) {
        setQrImage(s.qrCode);
        setQrTitle(s.title || 'Attendance QR');
        setShowQr(true);
      } else {
        // Open dialog anyway to indicate no QR available
        setQrImage(null);
        setQrTitle(s?.title || 'Attendance');
        setShowQr(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyQr = async (id?: string) => {
    try {
      let dataUrl = qrImage;
      if (!dataUrl && id) {
        const s: any = await getSession(id);
        dataUrl = s?.qrCode || null;
      }
      if (dataUrl) {
        await navigator.clipboard.writeText(dataUrl);
        toast.success('QR copied to clipboard');
      } else {
        toast.error('No QR available to copy');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to copy QR');
    }
  };

  const analyticsData = {
    stats: [
      { label: 'Total Students', value: 150, change: 2, trend: 'up' as const },
      { label: 'Present Today', value: 145, change: -1, trend: 'down' as const },
      { label: 'Absent Today', value: 3, change: 0, trend: 'neutral' as const },
      { label: 'Late Today', value: 2, change: -50, trend: 'down' as const },
    ],
    charts: {
      timeSeries: [
        { date: 'Mon', value: 145 },
        { date: 'Tue', value: 148 },
        { date: 'Wed', value: 147 },
        { date: 'Thu', value: 149 },
        { date: 'Fri', value: 145 },
      ],
      distribution: [
        { name: 'Present', value: 145 },
        { name: 'Late', value: 2 },
        { name: 'Absent', value: 3 },
      ],
      comparison: [
        { category: 'Block A', current: 98, previous: 95 },
        { category: 'Block B', current: 52, previous: 55 },
      ],
    },
  };

  const totalPages = Math.max(1, Math.ceil((sessionsTotal || sessions.length) / pageSize));
  const pagedSessions = sessions; // already server-paginated

  const [detailsRecords, setDetailsRecords] = useState<any[]>([]);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [detailsSortBy, setDetailsSortBy] = useState<'markedAt'|'status'|'hallticket'>('markedAt');
  const [detailsSortDir, setDetailsSortDir] = useState<'ASC'|'DESC'>('DESC');
  const detailsTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil((detailsTotal || detailsRecords.length) / detailsPageSize));
  }, [detailsTotal, detailsRecords]);

  useEffect(() => {
    if (details?.id) {
      listSessionRecords(details.id, {
        page: detailsPage,
        pageSize: detailsPageSize,
        status: detailsFilterStatus,
        search: detailsFilterSearch.trim() || undefined,
        sortBy: detailsSortBy,
        sortDir: detailsSortDir,
      })
        .then((res) => {
          setDetailsRecords(res.data || []);
          setDetailsTotal(res.total || 0);
        })
        .catch(() => {});
    }
  }, [details?.id, detailsPage, detailsFilterStatus, detailsFilterSearch, detailsSortBy, detailsSortDir]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">{t('attendance')} Management</h1>
          <p className="text-muted-foreground">Manage attendance sessions and view analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportSessionsPage}>
            <Download className="mr-2 h-4 w-4" />
            Export Sessions Page
          </Button>
          <Button variant="outline" onClick={() => handleExportSessionsServer('page')}>
            <Download className="mr-2 h-4 w-4" />
            Export Page (Server)
          </Button>
          <Button variant="outline" onClick={handleExportSessionsFilteredAll}>
            <Download className="mr-2 h-4 w-4" />
            Export Filtered (All)
          </Button>
          <Button variant="outline" onClick={() => handleExportSessionsServer('filtered-all')}>
            <Download className="mr-2 h-4 w-4" />
            Export Filtered (Server)
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            {t('export')} CSV
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            One-Tap Session
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="blueprint">Blueprint Planner</TabsTrigger>
          <TabsTrigger value="analytics">{t('dashboard')}</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={filterStatus} onValueChange={(v: 'ALL' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED') => setFilterStatus(v)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" className="mt-2" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Search title</label>
                  <Input placeholder="Search..." className="mt-2" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Sort</label>
                  <Select value={`${sortBy}:${sortDir}`} onValueChange={(v: string) => {
                    const [sb, sd] = v.split(':');
                    setSortBy(sb as any);
                    setSortDir(sd as any);
                    refresh({ page: 1 });
                  }}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt:DESC">Newest first</SelectItem>
                      <SelectItem value="createdAt:ASC">Oldest first</SelectItem>
                      <SelectItem value="scheduledAt:ASC">Scheduled soonest</SelectItem>
                      <SelectItem value="scheduledAt:DESC">Scheduled latest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={() => { setFilterStatus('ALL'); setFilterDate(''); setFilterSearch(''); }}>Clear</Button>
                  <Button onClick={() => refresh()} disabled={loading}>Apply</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active & Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pagedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => openDetails(session.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{session.scopeName}</h3>
                          <Badge variant={session.rawStatus === 'ACTIVE' ? 'default' : (session.rawStatus === 'SCHEDULED' ? 'secondary' : 'secondary')}>
                            {session.rawStatus || session.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.date).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.rawStatus === 'SCHEDULED' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm">Start</Button>
                            </AlertDialogTrigger>
                            <ConfirmContent>
                              <ConfirmHeader>
                                <ConfirmTitle>Start session?</ConfirmTitle>
                                <AlertDialogDescription>
                                  Students will be able to mark attendance via QR or manual methods.
                                </AlertDialogDescription>
                              </ConfirmHeader>
                              <ConfirmFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleStart(session.id)}>Start</AlertDialogAction>
                              </ConfirmFooter>
                            </ConfirmContent>
                          </AlertDialog>
                        )}
                        {session.rawStatus === 'ACTIVE' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleViewQr(session.id)}>View QR</Button>
                            <Button size="sm" variant="outline" onClick={() => handleCopyQr(session.id)}>Copy QR</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">End</Button>
                              </AlertDialogTrigger>
                              <ConfirmContent>
                                <ConfirmHeader>
                                  <ConfirmTitle>End session?</ConfirmTitle>
                                  <AlertDialogDescription>
                                    No further attendance can be marked once ended. This action cannot be undone.
                                  </AlertDialogDescription>
                                </ConfirmHeader>
                                <ConfirmFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleEnd(session.id)}>End</AlertDialogAction>
                                </ConfirmFooter>
                              </ConfirmContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Present</p>
                        <p className="text-lg font-semibold text-green-600">{session.presentCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Late</p>
                        <p className="text-lg font-semibold text-yellow-600">{session.lateCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Absent</p>
                        <p className="text-lg font-semibold text-red-600">{session.absentCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious size="default" href="#" onClick={(e) => { e.preventDefault(); const next = Math.max(1, page - 1); refresh({ page: next }); }} />
                    </PaginationItem>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <PaginationItem key={idx}>
                        <PaginationLink
                          size="default"
                          href="#"
                          isActive={page === idx + 1}
                          onClick={(e) => { e.preventDefault(); refresh({ page: idx + 1 }); }}
                        >
                          {idx + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext size="default" href="#" onClick={(e) => { e.preventDefault(); const next = Math.min(totalPages, page + 1); refresh({ page: next }); }} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blueprint" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blueprint Planner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1 border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5" />
                    <div className="font-medium">What is a Blueprint?</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Visualize and manage Blocks → Floors → Rooms → Beds (A/B/C/D). Use this to plan room-wise attendance and assignments.
                  </p>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => navigate('/warden/rooms')}>
                    Open Blueprint Editor
                  </Button>
                </div>
                <div className="lg:col-span-2">
                  <div className="mb-3">
                    <div className="font-medium">Room-wise Occupancy Snapshot</div>
                    <p className="text-sm text-muted-foreground">Quick chart to help plan room-wise roll calls.</p>
                  </div>
                  <div className="h-64 border rounded-lg p-2">
                    {roomsLoading ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading rooms…</div>
                    ) : roomsData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No rooms found</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={roomsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" hide={roomsData.length > 12} angle={roomsData.length > 8 ? -30 : 0} textAnchor="end" interval={0} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="capacity" fill="#94a3b8" name="Capacity" />
                          <Bar dataKey="occupied" fill="#3b82f6" name="Occupied" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Analytics
            period={analyticsPeriod}
            onPeriodChange={setAnalyticsPeriod}
            data={analyticsData}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create One-Tap Session</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Scope</label>
              <Select value={selectedScope} onValueChange={(v: 'FLOOR' | 'BLOCK' | 'ROOM') => setSelectedScope(v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLOOR">Floor</SelectItem>
                  <SelectItem value="BLOCK">Block</SelectItem>
                  <SelectItem value="ROOM">Room</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                This will create an instant attendance session using the default Mixed mode 
                (QR + Blueprint). Students can mark attendance via QR or you can mark manually.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateSession}>
              {t('create')} Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{qrTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            {qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImage} alt="Attendance QR" className="max-w-xs" />
            ) : (
              <p className="text-muted-foreground">No QR available (session may not be in QR mode).</p>
            )}
          </div>
          <DialogFooter>
            {qrImage && (
              <>
                <Button variant="outline" onClick={() => handleCopyQr()}>Copy</Button>
                <a href={qrImage} download="attendance-qr.png">
                  <Button variant="outline">Download</Button>
                </a>
              </>
            )}
            <Button onClick={() => setShowQr(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>
          {details ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{details.title}</h3>
                    <Badge variant={details.status === 'ACTIVE' ? 'default' : 'secondary'}>{details.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Scheduled: {details.scheduledAt ? new Date(details.scheduledAt).toLocaleString() : '-'}</p>
                </div>
                <div className="text-right space-y-2">
                  <div className="text-sm">
                    <div>Present: {details.totalPresent ?? 0}</div>
                    <div>Absent: {details.totalAbsent ?? 0}</div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    {details.status === 'SCHEDULED' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm">Start</Button>
                        </AlertDialogTrigger>
                        <ConfirmContent>
                          <ConfirmHeader>
                            <ConfirmTitle>Start session?</ConfirmTitle>
                            <AlertDialogDescription>
                              Students will be able to mark attendance via QR or manual methods.
                            </AlertDialogDescription>
                          </ConfirmHeader>
                          <ConfirmFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => { await handleStart(details.id); await loadDetails(details.id); }}>Start</AlertDialogAction>
                          </ConfirmFooter>
                        </ConfirmContent>
                      </AlertDialog>
                    )}
                    {details.status === 'ACTIVE' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleViewQr(details.id)}>View QR</Button>
                        <Button size="sm" variant="outline" onClick={() => handleCopyQr(details.id)}>Copy QR</Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          const s: any = details;
                          const dataUrl = s?.qrCode;
                          if (!dataUrl) { toast.error('No QR available to share'); return; }
                          try {
                            if (navigator.share) {
                              await navigator.share({ title: s?.title || 'Attendance QR', text: 'Attendance QR Code', url: dataUrl });
                            } else {
                              await navigator.clipboard.writeText(dataUrl);
                              toast.success('Copied QR to clipboard');
                            }
                          } catch {}
                        }}>Share</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">End</Button>
                          </AlertDialogTrigger>
                          <ConfirmContent>
                            <ConfirmHeader>
                              <ConfirmTitle>End session?</ConfirmTitle>
                              <AlertDialogDescription>
                                No further attendance can be marked once ended. This action cannot be undone.
                              </AlertDialogDescription>
                            </ConfirmHeader>
                            <ConfirmFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => { await handleEnd(details.id); await loadDetails(details.id); }}>End</AlertDialogAction>
                            </ConfirmFooter>
                          </ConfirmContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {details.status === 'ACTIVE' && details.qrCode && (
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">QR Check-in</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopyQr(details.id)}>Copy</Button>
                      <a href={details.qrCode} download="attendance-qr.png">
                        <Button size="sm" variant="outline">Download</Button>
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center justify-center py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={details.qrCode} alt="Attendance QR" className="max-w-xs" />
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-3">
                <div className="font-medium mb-2">Manual Mark</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input placeholder="Student ID / Hallticket" value={markStudentId} onChange={(e) => setMarkStudentId(e.target.value)} />
                  <Select value={markStatus} onValueChange={(v: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => setMarkStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENT">Present</SelectItem>
                      <SelectItem value="LATE">Late</SelectItem>
                      <SelectItem value="ABSENT">Absent</SelectItem>
                      <SelectItem value="EXCUSED">Excused</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button disabled={marking || !markStudentId.trim()} onClick={handleManualMark}>Mark</Button>
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Records</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-3">
                  <div>
                    <label className="text-sm font-medium">Sort</label>
                    <Select value={`${detailsSortBy}:${detailsSortDir}`} onValueChange={(v: string) => {
                      const [sb, sd] = v.split(':');
                      setDetailsSortBy(sb as any);
                      setDetailsSortDir(sd as any);
                      setDetailsPage(1);
                    }}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="markedAt:DESC">Latest first</SelectItem>
                        <SelectItem value="markedAt:ASC">Oldest first</SelectItem>
                        <SelectItem value="hallticket:ASC">Hallticket A→Z</SelectItem>
                        <SelectItem value="hallticket:DESC">Hallticket Z→A</SelectItem>
                        <SelectItem value="status:ASC">Status A→Z</SelectItem>
                        <SelectItem value="status:DESC">Status Z→A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-3">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={detailsFilterStatus} onValueChange={(v: 'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => { setDetailsFilterStatus(v); setDetailsPage(1); }}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="PRESENT">Present</SelectItem>
                        <SelectItem value="LATE">Late</SelectItem>
                        <SelectItem value="ABSENT">Absent</SelectItem>
                        <SelectItem value="EXCUSED">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Search student</label>
                    <Input placeholder="Name or Hallticket" className="mt-2" value={detailsFilterSearch} onChange={(e) => { setDetailsFilterSearch(e.target.value); setDetailsPage(1); }} />
                  </div>
                  <div className="flex gap-2 mt-6">
                    <Button variant="outline" onClick={() => { setDetailsFilterStatus('ALL'); setDetailsFilterSearch(''); setDetailsPage(1); }}>Clear</Button>
                  </div>
                  <div className="flex gap-2 mt-6 justify-end">
                    <Button variant="outline" onClick={async () => { if (!details?.id) return; const csv = await exportSessionRecords(details.id, { page: detailsPage, pageSize: detailsPageSize, status: detailsFilterStatus, search: detailsFilterSearch.trim() || undefined }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `attendance-${details.id}-page-${detailsPage}.csv`; a.click(); URL.revokeObjectURL(url); }}>Export page</Button>
                    <Button onClick={async () => { if (!details?.id) return; const csv = await exportSessionRecords(details.id, { status: detailsFilterStatus, search: detailsFilterSearch.trim() || undefined }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `attendance-${details.id}-filtered.csv`; a.click(); URL.revokeObjectURL(url); }}>Export filtered</Button>
                  </div>
                </div>
                <div className="max-h-72 overflow-auto border rounded-md">
                    <div className="divide-y">
                    {detailsRecords.map((r: any) => (
                      <div key={r.id} className="p-4 min-h-14 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{r.student?.firstName || ''} {r.student?.lastName || ''}</div>
                          <div className="text-muted-foreground">{r.student?.hallticket || r.student?.id}</div>
                        </div>
                        <div className="text-right">
                          <div className="uppercase tracking-wide">{r.status}</div>
                          <div className="text-muted-foreground">{new Date(r.markedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious size="default" href="#" onClick={(e) => { e.preventDefault(); setDetailsPage((p) => Math.max(1, p - 1)); }} />
                      </PaginationItem>
                      {Array.from({ length: detailsTotalPages }).map((_, idx) => (
                        <PaginationItem key={idx}>
                          <PaginationLink
                            size="default"
                            href="#"
                            isActive={detailsPage === idx + 1}
                            onClick={(e) => { e.preventDefault(); setDetailsPage(idx + 1); }}
                          >
                            {idx + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext size="default" href="#" onClick={(e) => { e.preventDefault(); setDetailsPage((p) => Math.min(detailsTotalPages, p + 1)); }} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Loading…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
