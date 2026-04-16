import { memo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const AudioPlayer = memo(({ url }: { url?: string }) => {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  if (!url) return null
  const origin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
  const audioUrl = url.startsWith('http') ? url : `${origin}${url}`

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 rounded-sm"
        onClick={(e) => {
          e.stopPropagation()
          if (audioRef.current) {
            if (playing) audioRef.current.pause()
            else audioRef.current.play()
            setPlaying(!playing)
          }
        }}
      >
        {playing ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-0.5" />}
      </Button>
      <span className="text-[10px] font-bold text-primary uppercase tracking-normaler">Audio Reason</span>
      <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  )
})

AudioPlayer.displayName = 'AudioPlayer'
