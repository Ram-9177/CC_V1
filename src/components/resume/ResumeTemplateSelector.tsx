import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from 'lucide-react'
import type { ResumeTemplate } from '@/hooks/useResumeBuilder'

interface Props {
  templates: ResumeTemplate[]
  selected: string
  onSelect: (id: string) => void
}

export function ResumeTemplateSelector({ templates, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {templates.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            'text-left border rounded-sm p-4 transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary',
            selected === t.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
            </div>
            {selected === t.id && <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-xs">ATS {t.ats_score}%</Badge>
            <Badge variant="outline" className="text-xs">{t.font}</Badge>
          </div>
        </button>
      ))}
    </div>
  )
}
