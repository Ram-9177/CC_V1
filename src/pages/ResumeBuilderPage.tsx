import { safeLazy } from "@/lib/safeLazy";

import { Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { FileText, Sparkles, Download, Edit3, Eye, User, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SEO } from '@/components/common/SEO'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import {
  useResumeProfile,
  useResumeTemplates,
  useResumePreview,
  useSaveProfile,
  useGenerateResume,
  useUpdateResume,
  useDownloadResume,
  type GeneratedResume,
} from '@/hooks/useResumeBuilder'

const ResumeProfileForm = safeLazy(() => import('@/components/resume/ResumeProfileForm').then(m => ({ default: m.ResumeProfileForm })))
const ResumeTemplateSelector = safeLazy(() => import('@/components/resume/ResumeTemplateSelector').then(m => ({ default: m.ResumeTemplateSelector })))
const ResumePreview = safeLazy(() => import('@/components/resume/ResumePreview').then(m => ({ default: m.ResumePreview })))
const ResumeEditor = safeLazy(() => import('@/components/resume/ResumeEditor').then(m => ({ default: m.ResumeEditor })))

export default function ResumeBuilderPage() {
  const [activeTab, setActiveTab] = useState('profile')

  const { data: profile, isLoading: profileLoading, isError: profileError, error: profileErr } = useResumeProfile()
  const { data: templates, isLoading: templatesLoading } = useResumeTemplates()
  const canFetchPreview = Boolean(profile?.generated_resume)
  const { data: preview, isFetching: previewFetching } = useResumePreview(canFetchPreview)

  const saveProfile = useSaveProfile()
  const generateResume = useGenerateResume()
  const updateResume = useUpdateResume()
  const downloadResume = useDownloadResume()

  if (profileLoading || templatesLoading) return <PageSkeleton />

  if (profileError) {
    if (isAxiosError(profileErr) && profileErr.response?.status === 403) {
    return (
      <>
        <SEO title="Resume Builder" description="Student resume tools" />
        <div className="max-w-lg mx-auto px-4 py-12">
          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Resume Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Resume Builder is available to students only. Your profile data and generated resumes are tied to your student account.</p>
              <Button asChild variant="default" className="w-full sm:w-auto">
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
    }
    return (
      <>
        <SEO title="Resume Builder" description="Build your ATS-friendly resume" />
        <div className="max-w-lg mx-auto px-4 py-12">
          <Card className="rounded-xl border border-border shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Could not load the resume builder. Check your connection and try again.
              </p>
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const resumeForEdit = (preview?.resume ?? profile?.generated_resume) as GeneratedResume | undefined
  const hasGenerated = Boolean(preview?.resume ?? profile?.generated_resume)
  const generationsLeft = profile ? Math.max(0, 3 - (profile.generation_count ?? 0)) : 3

  return (
    <>
      <SEO title="Resume Builder" description="Build your ATS-friendly resume" />
      <div className="page-frame max-w-5xl mx-auto px-0 sm:px-0 pb-6">

        {/* Header */}
        <div className="page-hero-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="page-eyebrow">Career</p>
              <h1 className="page-title">Resume Builder</h1>
              <p className="page-lead">ATS-optimised resume in minutes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasGenerated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadResume.mutate()}
                disabled={downloadResume.isPending}
              >
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            )}
            <Button
              size="sm"
              onClick={() =>
                generateResume.mutate(false, {
                  onSuccess: () => setActiveTab('preview'),
                })
              }
              disabled={generateResume.isPending || generationsLeft === 0}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {generateResume.isPending ? 'Generating…' : 'Generate Resume'}
            </Button>
            <Badge variant="secondary" className="text-xs">
              {generationsLeft}/3 left today
            </Badge>
          </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-1" /> Profile
            </TabsTrigger>
            <TabsTrigger value="template">
              <BookOpen className="h-4 w-4 mr-1" /> Template
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!hasGenerated}>
              <Eye className="h-4 w-4 mr-1" /> Preview
            </TabsTrigger>
            <TabsTrigger value="edit" disabled={!hasGenerated}>
              <Edit3 className="h-4 w-4 mr-1" /> Edit
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-4">
            <Suspense fallback={<PageSkeleton />}>
              <ResumeProfileForm
                profile={profile}
                onSave={(data) => saveProfile.mutate(data)}
                isSaving={saveProfile.isPending}
              />
            </Suspense>
          </TabsContent>

          {/* Template Tab */}
          <TabsContent value="template" className="mt-4">
            <Suspense fallback={<PageSkeleton />}>
              <ResumeTemplateSelector
                templates={templates ?? []}
                selected={profile?.selected_template ?? 'classic'}
                onSelect={(id) => {
                  saveProfile.mutate({ selected_template: id })
                  if (hasGenerated) updateResume.mutate({ selected_template: id })
                }}
              />
            </Suspense>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-4">
            <Suspense fallback={<PageSkeleton />}>
              {canFetchPreview && previewFetching && !preview ? (
                <PageSkeleton />
              ) : preview ? (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadResume.mutate()}
                      disabled={downloadResume.isPending}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download PDF
                    </Button>
                  </div>
                  <ResumePreview data={preview} />
                </div>
              ) : (
                <Card className="rounded-xl border border-border bg-card shadow-sm">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Save your profile, then click <strong>Generate Resume</strong>. After generation, your preview and PDF download will appear here.
                  </CardContent>
                </Card>
              )}
            </Suspense>
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="mt-4">
            <Suspense fallback={<PageSkeleton />}>
              {resumeForEdit ? (
                <ResumeEditor
                  resume={resumeForEdit}
                  onSave={(updated) => updateResume.mutate({ generated_resume: updated })}
                  isSaving={updateResume.isPending}
                />
              ) : (
                <Card className="rounded-xl border border-border bg-card shadow-sm">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Generate your resume first to edit it.
                  </CardContent>
                </Card>
              )}
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
