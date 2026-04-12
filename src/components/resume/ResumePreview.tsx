import type { PreviewData } from '@/hooks/useResumeBuilder'
import { cn } from '@/lib/utils'

interface Props {
  data: PreviewData
}

export function ResumePreview({ data }: Props) {
  const { resume: r, meta, template } = data

  const sectionClass = 'mt-4'
  const titleClass = cn(
    'text-xs font-bold uppercase tracking-widest pb-0.5 mb-2',
    template.heading_style === 'underline' && 'border-b border-foreground',
    template.heading_style === 'bold_border' && 'border-b-2 border-primary',
    template.heading_style === 'caps' && 'text-muted-foreground',
    template.heading_style === 'bold' && 'text-foreground',
  )

  return (
    <div
      className="bg-white text-black rounded-sm border shadow-sm p-8 max-w-3xl mx-auto text-[11pt] leading-snug"
      style={{ fontFamily: template.font || 'Arial' }}
    >
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{meta.full_name}</h1>
        <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
          {meta.email && <span>{meta.email}</span>}
          {meta.phone && <span>{meta.phone}</span>}
          {meta.linkedin && <span>{meta.linkedin}</span>}
          {meta.github && <span>{meta.github}</span>}
          {meta.course && <span>{meta.course}{meta.branch ? ` — ${meta.branch}` : ''}{meta.year ? `, Year ${meta.year}` : ''}</span>}
        </div>
      </div>

      {/* Render sections in template order */}
      {template.section_order.filter(s => s !== 'header').map(section => {
        switch (section) {
          case 'summary':
            return r.summary ? (
              <div key="summary" className={sectionClass}>
                <div className={titleClass}>Summary</div>
                <p className="text-[10.5pt]">{r.summary}</p>
              </div>
            ) : null

          case 'skills':
            return r.skills?.length ? (
              <div key="skills" className={sectionClass}>
                <div className={titleClass}>Skills</div>
                <p className="text-[10pt]">{r.skills.join(' • ')}</p>
              </div>
            ) : null

          case 'education':
            return r.education?.length ? (
              <div key="education" className={sectionClass}>
                <div className={titleClass}>Education</div>
                {r.education.map((edu, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[10.5pt]">{edu.degree}</span>
                      <span className="text-[9.5pt] text-gray-600">{edu.year}</span>
                    </div>
                    <div className="text-[9.5pt] text-gray-700">{edu.institution}{edu.gpa ? ` | GPA: ${edu.gpa}` : ''}</div>
                  </div>
                ))}
              </div>
            ) : null

          case 'experience':
            return r.experience?.length ? (
              <div key="experience" className={sectionClass}>
                <div className={titleClass}>Experience</div>
                {r.experience.map((exp, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[10.5pt]">{exp.title}</span>
                      <span className="text-[9.5pt] text-gray-600">{exp.duration}</span>
                    </div>
                    <div className="text-[9.5pt] text-gray-700 mb-1">{exp.company}</div>
                    <ul className="list-disc ml-4 space-y-0.5">
                      {exp.bullets?.map((b, j) => <li key={j} className="text-[9.5pt]">{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null

          case 'projects':
            return r.projects?.length ? (
              <div key="projects" className={sectionClass}>
                <div className={titleClass}>Projects</div>
                {r.projects.map((proj, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[10.5pt]">{proj.name}</span>
                      <span className="text-[9.5pt] text-gray-600">{proj.tech}</span>
                    </div>
                    <ul className="list-disc ml-4 space-y-0.5">
                      {proj.bullets?.map((b, j) => <li key={j} className="text-[9.5pt]">{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null

          case 'certifications':
            return r.certifications?.length ? (
              <div key="certifications" className={sectionClass}>
                <div className={titleClass}>Certifications</div>
                {r.certifications.map((cert, i) => (
                  <div key={i} className="flex justify-between text-[9.5pt] mb-1">
                    <span><span className="font-medium">{cert.name}</span> — {cert.issuer}</span>
                    <span className="text-gray-600">{cert.year}</span>
                  </div>
                ))}
              </div>
            ) : null

          case 'achievements':
            return r.achievements?.length ? (
              <div key="achievements" className={sectionClass}>
                <div className={titleClass}>Achievements</div>
                <ul className="list-none space-y-0.5">
                  {r.achievements.map((a, i) => <li key={i} className="text-[9.5pt]">▸ {a}</li>)}
                </ul>
              </div>
            ) : null

          default:
            return null
        }
      })}
    </div>
  )
}
