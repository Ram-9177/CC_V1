import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import type { ResumeProfile, EducationEntry, ExperienceEntry, ProjectEntry, CertEntry } from '@/hooks/useResumeBuilder'

interface Props {
  profile?: ResumeProfile
  onSave: (data: Partial<ResumeProfile>) => void
  isSaving: boolean
}

const EMPTY_EDU: EducationEntry = { degree: '', institution: '', year: '', gpa: '' }
const EMPTY_EXP: ExperienceEntry = { title: '', company: '', duration: '', bullets: [''] }
const EMPTY_PROJ: ProjectEntry = { name: '', tech: '', bullets: [''] }
const EMPTY_CERT: CertEntry = { name: '', issuer: '', year: '' }

export function ResumeProfileForm({ profile, onSave, isSaving }: Props) {
  const [form, setForm] = useState<Partial<ResumeProfile>>({
    full_name: '', email: '', phone: '', linkedin: '', github: '',
    course: '', branch: '', year: '', summary: '',
    skills: [], education: [], projects: [], experience: [],
    achievements: [], certifications: [],
  })

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  const set = (key: keyof ResumeProfile, val: string | string[] | unknown[]) => setForm(f => ({ ...f, [key]: val }))

  // Skills as comma-separated string for easy editing
  const skillsStr = (form.skills ?? []).join(', ')
  const achievementsStr = (form.achievements ?? []).join('\n')

  return (
    <div className="space-y-4">
      {/* Personal Info */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2 md:col-span-1">
            <Label>Full Name</Label>
            <Input value={form.full_name ?? ''} onChange={e => set('full_name', e.target.value)} placeholder="John Doe" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" />
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <Input value={form.linkedin ?? ''} onChange={e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/john" />
          </div>
          <div>
            <Label>GitHub URL</Label>
            <Input value={form.github ?? ''} onChange={e => set('github', e.target.value)} placeholder="github.com/john" />
          </div>
          <div>
            <Label>Course</Label>
            <Input value={form.course ?? ''} onChange={e => set('course', e.target.value)} placeholder="B.Tech" />
          </div>
          <div>
            <Label>Branch</Label>
            <Input value={form.branch ?? ''} onChange={e => set('branch', e.target.value)} placeholder="Computer Science" />
          </div>
          <div>
            <Label>Year</Label>
            <Input value={form.year ?? ''} onChange={e => set('year', e.target.value)} placeholder="3rd Year" />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Summary (optional — AI will improve it)</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={form.summary ?? ''} onChange={e => set('summary', e.target.value)} placeholder="Brief professional summary..." />
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Skills (comma-separated)</CardTitle></CardHeader>
        <CardContent>
          <Input
            value={skillsStr}
            onChange={e => set('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="Python, React, SQL, Git..."
          />
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Education</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => set('education', [...(form.education ?? []), { ...EMPTY_EDU }])}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(form.education ?? []).map((edu, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 border rounded p-3 relative">
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6"
                aria-label="Remove education item"
                onClick={() => set('education', (form.education ?? []).filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <Input placeholder="Degree" value={edu.degree} onChange={e => { const a = [...(form.education ?? [])]; a[i] = { ...a[i], degree: e.target.value }; set('education', a) }} />
              <Input placeholder="Institution" value={edu.institution} onChange={e => { const a = [...(form.education ?? [])]; a[i] = { ...a[i], institution: e.target.value }; set('education', a) }} />
              <Input placeholder="Year (e.g. 2024)" value={edu.year} onChange={e => { const a = [...(form.education ?? [])]; a[i] = { ...a[i], year: e.target.value }; set('education', a) }} />
              <Input placeholder="GPA (optional)" value={edu.gpa ?? ''} onChange={e => { const a = [...(form.education ?? [])]; a[i] = { ...a[i], gpa: e.target.value }; set('education', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Projects</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => set('projects', [...(form.projects ?? []), { ...EMPTY_PROJ }])}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(form.projects ?? []).map((proj, i) => (
            <div key={i} className="border rounded p-3 space-y-2 relative">
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6"
                aria-label="Remove project item"
                onClick={() => set('projects', (form.projects ?? []).filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Project Name" value={proj.name} onChange={e => { const a = [...(form.projects ?? [])]; a[i] = { ...a[i], name: e.target.value }; set('projects', a) }} />
                <Input placeholder="Tech Stack" value={proj.tech} onChange={e => { const a = [...(form.projects ?? [])]; a[i] = { ...a[i], tech: e.target.value }; set('projects', a) }} />
              </div>
              <Textarea rows={2} placeholder="Key points (one per line)" value={(proj.bullets ?? []).join('\n')}
                onChange={e => { const a = [...(form.projects ?? [])]; a[i] = { ...a[i], bullets: e.target.value.split('\n') }; set('projects', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Experience</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => set('experience', [...(form.experience ?? []), { ...EMPTY_EXP }])}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(form.experience ?? []).map((exp, i) => (
            <div key={i} className="border rounded p-3 space-y-2 relative">
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6"
                aria-label="Remove experience item"
                onClick={() => set('experience', (form.experience ?? []).filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Job Title" value={exp.title} onChange={e => { const a = [...(form.experience ?? [])]; a[i] = { ...a[i], title: e.target.value }; set('experience', a) }} />
                <Input placeholder="Company" value={exp.company} onChange={e => { const a = [...(form.experience ?? [])]; a[i] = { ...a[i], company: e.target.value }; set('experience', a) }} />
                <Input placeholder="Duration (e.g. Jun–Aug 2024)" value={exp.duration} onChange={e => { const a = [...(form.experience ?? [])]; a[i] = { ...a[i], duration: e.target.value }; set('experience', a) }} />
              </div>
              <Textarea rows={2} placeholder="Key achievements (one per line)" value={(exp.bullets ?? []).join('\n')}
                onChange={e => { const a = [...(form.experience ?? [])]; a[i] = { ...a[i], bullets: e.target.value.split('\n') }; set('experience', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Certifications</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => set('certifications', [...(form.certifications ?? []), { ...EMPTY_CERT }])}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(form.certifications ?? []).map((cert, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 border rounded p-3 relative">
              <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6"
                aria-label="Remove certification item"
                onClick={() => set('certifications', (form.certifications ?? []).filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <Input placeholder="Certificate Name" value={cert.name} onChange={e => { const a = [...(form.certifications ?? [])]; a[i] = { ...a[i], name: e.target.value }; set('certifications', a) }} />
              <Input placeholder="Issuer" value={cert.issuer} onChange={e => { const a = [...(form.certifications ?? [])]; a[i] = { ...a[i], issuer: e.target.value }; set('certifications', a) }} />
              <Input placeholder="Year" value={cert.year} onChange={e => { const a = [...(form.certifications ?? [])]; a[i] = { ...a[i], year: e.target.value }; set('certifications', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Achievements (one per line)</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={achievementsStr}
            onChange={e => set('achievements', e.target.value.split('\n').filter(Boolean))}
            placeholder="Won hackathon, Published paper, Dean's list..." />
        </CardContent>
      </Card>

      <Button onClick={() => onSave(form)} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Profile'}
      </Button>
    </div>
  )
}
