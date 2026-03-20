import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export interface ResumeProfile {
  id?: number
  full_name: string
  email: string
  phone: string
  linkedin: string
  github: string
  course: string
  branch: string
  year: string
  skills: string[]
  education: EducationEntry[]
  projects: ProjectEntry[]
  experience: ExperienceEntry[]
  achievements: string[]
  certifications: CertEntry[]
  summary: string
  selected_template: string
  generated_resume?: GeneratedResume | null
  last_generated_at?: string | null
  generation_count?: number
  generations_remaining?: number
}

export interface EducationEntry {
  degree: string
  institution: string
  year: string
  gpa?: string
}

export interface ExperienceEntry {
  title: string
  company: string
  duration: string
  bullets: string[]
}

export interface ProjectEntry {
  name: string
  tech: string
  bullets: string[]
}

export interface CertEntry {
  name: string
  issuer: string
  year: string
}

export interface GeneratedResume {
  summary: string
  skills: string[]
  education: EducationEntry[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  certifications: CertEntry[]
  achievements: string[]
}

export interface ResumeTemplate {
  id: string
  name: string
  description: string
  layout: string
  font: string
  heading_style: string
  section_order: string[]
  ats_score: number
}

export interface PreviewData {
  resume: GeneratedResume
  template: ResumeTemplate
  meta: {
    full_name: string
    email: string
    phone: string
    linkedin: string
    github: string
    course: string
    branch: string
    year: string
  }
}

export function useResumeProfile() {
  return useQuery<ResumeProfile>({
    queryKey: ['resume', 'profile'],
    queryFn: () => api.get('/resume/profile/').then(r => r.data),
    staleTime: 60_000,
  })
}

export function useResumeTemplates() {
  return useQuery<ResumeTemplate[]>({
    queryKey: ['resume', 'templates'],
    queryFn: () => api.get('/resume/templates/').then(r => r.data),
    staleTime: Infinity, // templates never change at runtime
  })
}

export function useResumePreview() {
  return useQuery<PreviewData>({
    queryKey: ['resume', 'preview'],
    queryFn: () => api.get('/resume/preview/').then(r => r.data),
    staleTime: 60_000,
    retry: false,
  })
}

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ResumeProfile>) => api.post('/resume/profile/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resume', 'profile'] })
      qc.invalidateQueries({ queryKey: ['resume', 'preview'] })
      toast.success('Profile saved')
    },
    onError: () => toast.error('Failed to save profile'),
  })
}

export function useGenerateResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (force = false) => api.post('/resume/generate/', { force }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resume', 'preview'] })
      qc.invalidateQueries({ queryKey: ['resume', 'profile'] })
      toast.success('Resume generated')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Generation failed'
      toast.error(msg)
    },
  })
}

export function useUpdateResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { generated_resume?: GeneratedResume; selected_template?: string }) =>
      api.post('/resume/update/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resume', 'preview'] })
      toast.success('Resume updated')
    },
    onError: () => toast.error('Failed to update resume'),
  })
}

export function useDownloadResume() {
  return useMutation({
    mutationFn: async () => {
      const resp = await api.get('/resume/download/', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'resume.pdf'
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: () => toast.error('PDF download failed'),
  })
}
