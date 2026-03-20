import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GeneratedResume } from '@/hooks/useResumeBuilder'

interface Props {
  resume: GeneratedResume
  onSave: (updated: GeneratedResume) => void
  isSaving: boolean
}

export function ResumeEditor({ resume, onSave, isSaving }: Props) {
  const [draft, setDraft] = useState<GeneratedResume>(resume)

  useEffect(() => { setDraft(resume) }, [resume])

  const set = (key: keyof GeneratedResume, val: string | string[] | unknown[]) => setDraft(d => ({ ...d, [key]: val }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Edit any section below. Changes are saved without re-triggering AI.</p>

      {/* Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={draft.summary ?? ''} onChange={e => set('summary', e.target.value)} />
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Skills (comma-separated)</CardTitle></CardHeader>
        <CardContent>
          <Input
            value={(draft.skills ?? []).join(', ')}
            onChange={e => set('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          />
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Education</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(draft.education ?? []).map((edu, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 border rounded p-3">
              <Input placeholder="Degree" value={edu.degree} onChange={e => { const a = [...draft.education]; a[i] = { ...a[i], degree: e.target.value }; set('education', a) }} />
              <Input placeholder="Institution" value={edu.institution} onChange={e => { const a = [...draft.education]; a[i] = { ...a[i], institution: e.target.value }; set('education', a) }} />
              <Input placeholder="Year" value={edu.year} onChange={e => { const a = [...draft.education]; a[i] = { ...a[i], year: e.target.value }; set('education', a) }} />
              <Input placeholder="GPA" value={edu.gpa ?? ''} onChange={e => { const a = [...draft.education]; a[i] = { ...a[i], gpa: e.target.value }; set('education', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Projects</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(draft.projects ?? []).map((proj, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={proj.name} onChange={e => { const a = [...draft.projects]; a[i] = { ...a[i], name: e.target.value }; set('projects', a) }} />
                <Input placeholder="Tech" value={proj.tech} onChange={e => { const a = [...draft.projects]; a[i] = { ...a[i], tech: e.target.value }; set('projects', a) }} />
              </div>
              <Textarea rows={2} placeholder="Bullets (one per line)" value={(proj.bullets ?? []).join('\n')}
                onChange={e => { const a = [...draft.projects]; a[i] = { ...a[i], bullets: e.target.value.split('\n') }; set('projects', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Experience</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(draft.experience ?? []).map((exp, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Title" value={exp.title} onChange={e => { const a = [...draft.experience]; a[i] = { ...a[i], title: e.target.value }; set('experience', a) }} />
                <Input placeholder="Company" value={exp.company} onChange={e => { const a = [...draft.experience]; a[i] = { ...a[i], company: e.target.value }; set('experience', a) }} />
                <Input placeholder="Duration" value={exp.duration} onChange={e => { const a = [...draft.experience]; a[i] = { ...a[i], duration: e.target.value }; set('experience', a) }} />
              </div>
              <Textarea rows={2} placeholder="Bullets (one per line)" value={(exp.bullets ?? []).join('\n')}
                onChange={e => { const a = [...draft.experience]; a[i] = { ...a[i], bullets: e.target.value.split('\n') }; set('experience', a) }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Achievements (one per line)</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={(draft.achievements ?? []).join('\n')}
            onChange={e => set('achievements', e.target.value.split('\n').filter(Boolean))} />
        </CardContent>
      </Card>

      <Button onClick={() => onSave(draft)} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Edits'}
      </Button>
    </div>
  )
}
