import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Briefcase, MapPin, Linkedin, Users, Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PageSkeleton } from '@/components/common/PageSkeleton'

interface AlumniProfile {
  id: string
  user: string
  user_details: { id: number; username: string; first_name: string; last_name: string }
  graduation_year: number
  department: string
  current_company: string
  job_role: string
  location: string
  linkedin: string
  achievements: string
  is_active: boolean
  is_mentor: boolean
}

interface AlumniFormData {
  graduation_year: number | ''
  department: string
  current_company: string
  job_role: string
  location: string
  linkedin: string
  achievements: string
  is_mentor: boolean
}

const EMPTY_FORM: AlumniFormData = {
  graduation_year: '',
  department: '',
  current_company: '',
  job_role: '',
  location: '',
  linkedin: '',
  achievements: '',
  is_mentor: false,
}

function AlumniCard({ profile, isAdmin, onEdit, onDelete }: {
  profile: AlumniProfile
  isAdmin: boolean
  onEdit: (p: AlumniProfile) => void
  onDelete: (id: string) => void
}) {
  const name = [profile.user_details?.first_name, profile.user_details?.last_name].filter(Boolean).join(' ')
    || profile.user_details?.username || '—'

  return (
    <div className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{profile.department} · {profile.graduation_year}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {profile.is_mentor && <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">Mentor</Badge>}
          {!profile.is_active && <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-500">Inactive</Badge>}
          {isAdmin && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(profile)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => onDelete(profile.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {profile.job_role && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{profile.job_role}{profile.current_company ? ` @ ${profile.current_company}` : ''}</span>
          </div>
        )}
        {profile.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{profile.location}</span>
          </div>
        )}
        {profile.linkedin && (
          <div className="flex items-center gap-2 text-sm">
            <Linkedin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate text-xs">{profile.linkedin}</a>
          </div>
        )}
        {profile.achievements && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{profile.achievements}</p>
        )}
      </div>
    </div>
  )
}

function AlumniFormDialog({ initial, onClose, onSave }: {
  initial?: AlumniProfile | null
  onClose: () => void
  onSave: (data: AlumniFormData) => void
}) {
  const [form, setForm] = useState<AlumniFormData>(
    initial ? {
      graduation_year: initial.graduation_year,
      department: initial.department,
      current_company: initial.current_company,
      job_role: initial.job_role,
      location: initial.location,
      linkedin: initial.linkedin,
      achievements: initial.achievements,
      is_mentor: initial.is_mentor,
    } : EMPTY_FORM
  )

  const set = (k: keyof AlumniFormData, v: string | boolean | number) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-black text-foreground">{initial ? 'Edit Alumni' : 'Add Alumni Profile'}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-6 space-y-3 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Graduation Year *</label>
              <Input type="number" value={form.graduation_year} onChange={e => set('graduation_year', Number(e.target.value))} className="mt-1" min={1900} max={2100} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department *</label>
              <Input value={form.department} onChange={e => set('department', e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Job Role</label>
              <Input value={form.job_role} onChange={e => set('job_role', e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Company</label>
              <Input value={form.current_company} onChange={e => set('current_company', e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Location</label>
            <Input value={form.location} onChange={e => set('location', e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">LinkedIn URL</label>
            <Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} className="mt-1" type="url" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Achievements</label>
            <textarea
              value={form.achievements}
              onChange={e => set('achievements', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_mentor" checked={form.is_mentor} onChange={e => set('is_mentor', e.target.checked)} className="h-4 w-4" />
            <label htmlFor="is_mentor" className="text-sm font-medium text-foreground">Available as Mentor</label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} className="gap-1.5">
            <Check className="h-4 w-4" />
            {initial ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AlumniPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = ['admin', 'super_admin'].includes(user?.role ?? '')
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [mentorOnly, setMentorOnly] = useState(false)
  const [editTarget, setEditTarget] = useState<AlumniProfile | null | undefined>(undefined)
  // undefined = dialog closed, null = new, AlumniProfile = edit

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-list'],
    queryFn: async () => {
      const r = await api.get('/alumni/alumni-profiles/')
      return (r.data.results ?? r.data) as AlumniProfile[]
    },
    staleTime: 2 * 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (payload: AlumniFormData) => api.post('/alumni/alumni-profiles/', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-list'] }); setEditTarget(undefined); toast.success('Alumni profile created') },
    onError: () => toast.error('Failed to create alumni profile'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AlumniFormData }) => api.patch(`/alumni/alumni-profiles/${id}/`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-list'] }); setEditTarget(undefined); toast.success('Alumni profile updated') },
    onError: () => toast.error('Failed to update alumni profile'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/alumni/alumni-profiles/${id}/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alumni-list'] }); toast.success('Alumni profile deleted') },
    onError: () => toast.error('Failed to delete alumni profile'),
  })

  const handleSave = (formData: AlumniFormData) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const filtered = (data ?? []).filter(p => {
    if (mentorOnly && !p.is_mentor) return false
    if (!search) return true
    const q = search.toLowerCase()
    const name = [p.user_details?.first_name, p.user_details?.last_name].join(' ').toLowerCase()
    return (
      name.includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.current_company.toLowerCase().includes(q) ||
      String(p.graduation_year).includes(q)
    )
  })

  return (
    <div className="page-frame mx-auto min-w-0 w-full max-w-6xl pb-8">
      <div className="page-hero-card mb-4 sm:mb-6">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="page-title text-2xl">Alumni Network</h1>
              <p className="page-lead mt-0 text-sm">Former students — {data?.length ?? 0} profiles</p>
            </div>
          </div>
          {isAdmin && (
            <div className="page-align-actions">
              <Button onClick={() => setEditTarget(null)} className="w-full gap-1.5 sm:w-auto">
                <Plus className="h-4 w-4 shrink-0" />
                Add Alumni
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Filters */}
        <div className="page-align-actions items-center">
          <Input
            placeholder="Search name, department, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-full bg-card sm:max-w-xs"
          />
          <button
            type="button"
            onClick={() => setMentorOnly(v => !v)}
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              mentorOnly
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-border bg-card text-muted-foreground hover:border-primary'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Mentors only
          </button>
        </div>

        {isLoading ? (
          <PageSkeleton variant="list" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No alumni profiles found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <AlumniCard
                key={p.id}
                profile={p}
                isAdmin={isAdmin}
                onEdit={setEditTarget}
                onDelete={id => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {editTarget !== undefined && (
        <AlumniFormDialog
          initial={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
