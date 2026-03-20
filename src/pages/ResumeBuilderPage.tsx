import { useState } from 'react'
import { FileText, Sparkles, Download, Edit3, Eye, User, BookOpen, Briefcase, Code2, Award, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SEO } from '@/components/common/SEO'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import {
  useResumeProfile, useResumeTemplates, useResumePreview,
  useSaveProfile, useGenerateResume, useUpdateResume, useDownloadResume,
  type ResumeProfile, type GeneratedResume,
} from '@/hooks/useResumeBuilder'
import { ResumeProfileForm } from '@/components/resume/ResumeProfileForm'
import { ResumeTemplateSelector } from '@/components/resume/ResumeTemplateSelector'
import { ResumePreview } from '@/components/resume/ResumePreview'
import { ResumeEditor } from '@/components/resume/ResumeEditor'

export default function ResumeBuilderPage() {
  const [activeTab, setActiveTab] = useState('profile')

  const { data: profile, isLoading: profileLoading } = useResumeProfile()
  const { data: templates, isLoading: templatesLoading } = useResumeTemplates()
  const { data: preview, isLoading: previewLoading } = useResumePreview()

  const saveProfile = useSaveProfile()
  const generateResume = useGenerateResume()
  const updateResume = useUpdateResume()
  const downloadResume = useDownloadResume()

  if (profileLoading || templatesLoading) return <PageSkeleton />

  const hasGenerated = !!preview?.resume
  const generationsLeft = profile ? Math.max(0, 3 - (profile.generation_count ?? 0)) : 3

  return (
    <>
      <SEO title="Resume Builder" description="Build your ATS-friendly resume" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Resume Builder</h1>
              <p className="text-sm text-muted-foreground">ATS-optimised resume in minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => generateResume.mutate(false)}
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
            <ResumeProfileForm
              profile={profile}
              onSave={(data) => saveProfile.mutate(data)}
              isSaving={saveProfile.isPending}
            />
          </TabsContent>

          {/* Template Tab */}
          <TabsContent value="template" className="mt-4">
            <ResumeTemplateSelector
              templates={templates ?? []}
              selected={profile?.selected_template ?? 'classic'}
              onSelect={(id) => {
                saveProfile.mutate({ selected_template: id })
                if (hasGenerated) updateResume.mutate({ selected_template: id })
              }}
            />
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-4">
            {preview ? (
              <ResumePreview data={preview} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Generate your resume first to see the preview.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="mt-4">
            {preview?.resume ? (
              <ResumeEditor
                resume={preview.resume}
                onSave={(updated) => updateResume.mutate({ generated_resume: updated })}
                isSaving={updateResume.isPending}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Generate your resume first to edit it.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
