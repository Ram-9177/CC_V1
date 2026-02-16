
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onClear: () => void;
  maxDuration?: number;
}

export function AudioRecorder({ onRecordingComplete, onClear, maxDuration = 40 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      // Request microphone permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onRecordingComplete(blob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      toast.success('Recording started...');

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            toast.info(`Recording stopped at ${maxDuration}s limit`);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Microphone error:', err);
      
      // Handle different permission errors
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone permission denied. Please enable it in browser settings.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else if (err.name === 'SecurityError') {
        toast.error('Microphone access requires HTTPS or localhost.');
      } else {
        toast.error(`Microphone error: ${err.message || 'Unknown error'}`);
      }
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const clearRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    onClear();
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-widest text-slate-500">
          Reason Audio Brief (Max {maxDuration}s)
        </label>
        <div className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter",
          isRecording ? "bg-destructive" : "bg-slate-200",
          isRecording ? "text-white" : "text-slate-500",
          isRecording && "animate-pulse"
        )}>
          {isRecording ? 'RECORDING' : 'IDLE'} • {formatTime(duration)}
        </div>
      </div>

      {!audioUrl ? (
        <div className="space-y-3">
          <div className="flex justify-center py-2">
            {!isRecording ? (
              <Button
                type="button"
                onClick={startRecording}
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 text-foreground shadow-lg shadow-primary/20 transition-all hover:scale-110 active:scale-95 group relative"
              >
                <Mic className="h-8 w-8 group-hover:rotate-12 transition-transform" />
                {/* Pulsing ring animation */}
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse"></div>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={stopRecording}
                className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 transition-all animate-pulse"
              >
                <Square className="h-8 w-8 fill-current" />
              </Button>
            )}
          </div>
          {!isRecording && (
            <p className="text-xs text-center text-slate-500 px-2">
              Allow microphone access when browser asks permission
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            className="h-10 w-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </Button>
          
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(duration / maxDuration) * 100}%` }}
            ></div>
          </div>

          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clearRecording}
              className="h-9 w-9 rounded-lg border-destructive/20 text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                clearRecording();
                startRecording();
              }}
              className="h-9 w-9 rounded-lg border-primary/20 text-primary hover:bg-primary/5"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)} 
            className="hidden"
          />
        </div>
      )}

      {!audioUrl && !isRecording && (
        <p className="text-[10px] text-center text-muted-foreground font-medium">
          Tap the mic to record a brief voice reason for your request.
        </p>
      )}
    </div>
  );
}
