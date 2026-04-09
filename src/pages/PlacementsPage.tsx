import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useCommon'
import {
  Briefcase, Building2, GraduationCap,
  CheckCircle2, Clock, XCircle, ChevronRight, Search,
  Award, IndianRupee
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { cn, getApiErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageSkeleton } from '@/components/common/PageSkeleton'

interface Company {
  id: string
  name: string
  industry: string
  website?: string
}

interface JobPosting {
  id: string
  title: string
  company: Company
  description: string
  package: number
  min_cgpa: number
  application_deadline: string
  status: 'active' | 'closed' | 'draft'
  eligibility_criteria?: { allowed_departments?: string[] }
  application_count?: number
  my_application_status?: string | null
}

interface Application {
  id: string
  job: JobPosting
  status: 'applied' | 'shortlisted' | 'selected' | 'rejected'
  applied_at: string
  feedback?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:      { label: 'Active',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'text-slate-500 bg-slate-50 border-slate-200',       icon: XCircle },
  applied:     { label: 'Applied',     color: 'text-blue-600 bg-blue-50 border-blue-200',          icon: CheckCircle2 },
  shortlisted: { label: 'Shortlisted', color: 'text-amber-600 bg-amber-50 border-amber-200',       icon: Award },
  selected:    { label: 'Selected 🎉', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Award },
  rejected:    { label: 'Rejected',    color: 'text-rose-600 bg-rose-50 border-rose-200',          icon: XCircle },
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
      <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-black text-foreground">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function PlacementsPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const isStudent = user?.role === 'student'
  const isStaff = !isStudent
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [tab, setTab] = useState<'jobs' | 'applications'>('jobs')

  const { data: jobs, isLoading: loadingJobs } = useQuery<JobPosting[]>({
    queryKey: ['placements-jobs'],
    queryFn: async () => {
      const r = await api.get('/placements/job-postings/')
      return r.data.results ?? r.data
    },
    staleTime: 60_000,
  })

  const { data: myApplications, isLoading: loadingApps } = useQuery<Application[]>({
    queryKey: ['placements-my-apps'],
    enabled: isStudent,
    queryFn: async () => {
      const r = await api.get('/placements/applications/')
      return r.data.results ?? r.data
    },
  })

  const { data: analytics } = useQuery({
    queryKey: ['placements-analytics'],
    enabled: isStaff,
    queryFn: async () => {
      const r = await api.get('/placements/job-postings/placement_analytics/')
      return r.data
    },
  })

  const applyMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return api.post(`/placements/job-postings/${jobId}/apply/`)
    },
    onSuccess: () => {
      toast.success('Application submitted successfully!')
      qc.invalidateQueries({ queryKey: ['placements-jobs'] })
      qc.invalidateQueries({ queryKey: ['placements-my-apps'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Application failed')),
  })

  const filteredJobs = (jobs ?? []).filter(j =>
    j.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    j.company?.name?.toLowerCase().includes(debouncedSearch.toLowerCase())
  )

  const formatPackage = (val: number) =>
    val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val?.toLocaleString('en-IN')}`

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 sm:px-6 sm:py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Career Placements</h1>
              <p className="text-sm text-muted-foreground">Company listings, job applications & placement outcomes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-3 sm:space-y-4 pb-6">
        {/* Stats for staff */}
        {isStaff && analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Briefcase}    label="Total Postings"    value={analytics.summary?.total_postings ?? 0}    color="bg-blue-50 text-blue-600" />
            <StatCard icon={GraduationCap} label="Applications"     value={analytics.summary?.total_applications ?? 0} color="bg-purple-50 text-purple-600" />
            <StatCard icon={Award}        label="Placed Students"   value={analytics.summary?.placed_students ?? 0}    color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={IndianRupee}  label="Avg Package"       value={analytics.summary?.avg_package_offered ? formatPackage(analytics.summary.avg_package_offered) : 'N/A'} color="bg-amber-50 text-amber-600" />
          </div>
        )}

        {/* Student stats */}
        {isStudent && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon={Briefcase}   label="Open Jobs"     value={filteredJobs.filter(j => j.status === 'active').length} color="bg-blue-50 text-blue-600" />
            <StatCard icon={Clock}       label="My Applications" value={myApplications?.length ?? 0}                         color="bg-amber-50 text-amber-600" />
            <StatCard icon={CheckCircle2} label="Shortlisted"  value={myApplications?.filter(a => a.status === 'shortlisted' || a.status === 'selected').length ?? 0} color="bg-emerald-50 text-emerald-600" />
          </div>
        )}

        {/* Tabs */}
        {isStudent && (
          <div className="w-full md:w-fit">
            <div className="md:hidden relative">
              <select
                value={tab}
                onChange={e => setTab(e.target.value as 'jobs' | 'applications')}
                className="w-full p-3 pr-10 rounded-lg border-2 border-primary/20 bg-white text-[13px] font-black uppercase tracking-widest text-foreground shadow-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none transition-all"
              >
                <option value="jobs">Job Listings</option>
                <option value="applications">My Applications</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronRight className="h-4 w-4 text-primary rotate-90" />
              </div>
            </div>
            <div className="hidden md:flex gap-1 bg-muted p-1 rounded-xl border border-border">
              {(['jobs', 'applications'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('px-4 py-2 rounded text-xs font-black uppercase tracking-widest transition-all',
                    tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}>
                  {t === 'jobs' ? 'Job Listings' : 'My Applications'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        {tab === 'jobs' || isStaff ? (
          <>
            {/* Search */}
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search companies, roles…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            {loadingJobs ? (
              <PageSkeleton variant="analytics" />
            ) : filteredJobs.length === 0 ? (
              <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-bold">No job postings found</p>
                <p className="text-sm text-muted-foreground mt-1">Check back soon for new opportunities</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map(job => {
                  const st = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.active
                  const appStatus = job.my_application_status
                  const appSt = appStatus ? STATUS_CONFIG[appStatus] : null
                  const alreadyApplied = !!appStatus
                  return (
                    <div key={job.id} className="bg-card rounded-xl border border-border shadow-sm hover:border-primary/30 transition-all p-4">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Building2 className="h-6 w-6 text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-foreground text-base">{job.title}</p>
                            <p className="text-sm text-muted-foreground font-medium">{job.company?.name}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className={cn('text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border', st.color)}>
                                {st.label}
                              </span>
                              {job.package > 0 && (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  {formatPackage(job.package)} / yr
                                </span>
                              )}
                              {job.min_cgpa > 0 && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                  CGPA ≥ {job.min_cgpa}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {appSt && (
                            <span className={cn('text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border', appSt.color)}>
                              {appSt.label}
                            </span>
                          )}
                          {isStudent && job.status === 'active' && !alreadyApplied && (
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-black font-black text-xs uppercase tracking-widest"
                              onClick={() => applyMutation.mutate(job.id)}
                              disabled={applyMutation.isPending}
                            >
                              Apply Now <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {job.description && (
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-2 ml-[60px]">{job.description}</p>
                      )}

                      {job.application_deadline && (
                        <p className="text-[10px] text-muted-foreground mt-2 ml-[60px] flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          Deadline: {new Date(job.application_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          // My Applications tab
          <div className="space-y-3">
            {loadingApps ? (
              <PageSkeleton variant="analytics" />
            ) : !myApplications?.length ? (
              <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-bold text-muted-foreground">No applications yet</p>
                <p className="text-sm text-muted-foreground mt-1">Browse job listings and apply to get started</p>
                <Button variant="outline" className="mt-4" onClick={() => setTab('jobs')}>Browse Jobs</Button>
              </div>
            ) : myApplications.map(app => {
              const st = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.applied
              const Icon = st.icon
              return (
                <div key={app.id} className="bg-card rounded-xl border border-border shadow-sm p-4 flex gap-3 items-start">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border', st.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-foreground">{app.job?.title}</p>
                    <p className="text-sm text-muted-foreground">{app.job?.company?.name}</p>
                    {app.feedback && <p className="text-xs text-muted-foreground bg-slate-50 rounded p-2 mt-2 border">{app.feedback}</p>}
                    <p className="text-[10px] text-muted-foreground mt-2">Applied {new Date(app.applied_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={cn('text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border shrink-0', st.color)}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
