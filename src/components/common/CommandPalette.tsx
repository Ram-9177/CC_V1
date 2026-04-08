import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { Search, User, DoorOpen as Door, FileText as Pass, AlertCircle as Alert, Loader2, Sparkles } from 'lucide-react'
import { useUIStore } from '@/lib/ui-store'
import { api } from '@/lib/api'
import { useDebounce } from '@/hooks/useCommon'

interface SearchResult {
  id: string | number
  category: string
  title: string
  subtitle: string
  url: string | null
  icon: 'user' | 'door' | 'pass' | 'alert'
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { commandPaletteOpen, setCommandPaletteOpen, toggleCommandPalette } = useUIStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedSearch = useDebounce(search, 300)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const shortcutText = isMac ? 'Cmd + K' : 'Ctrl + K'

  // Toggle on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleCommandPalette()
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [toggleCommandPalette])

  // Fetch results
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setResults([])
      return
    }

    const fetchResults = async () => {
      setLoading(true)
      try {
        const response = await api.get(`/search/global/?q=${encodeURIComponent(debouncedSearch)}`)
        setResults(response.data.results)
      } catch (err) {
        console.error('Command Palette Search failed:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [debouncedSearch])

  const runCommand = useCallback((command: () => void) => {
    setCommandPaletteOpen(false)
    command()
  }, [setCommandPaletteOpen])

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={() => setCommandPaletteOpen(false)}
      />
      
      {/* Palette */}
      <Command 
        aria-label="Global command palette"
        aria-describedby="command-palette-shortcuts"
        className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl border-0 overflow-hidden ring-1 ring-black/5 animate-in zoom-in-95 duration-200"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setCommandPaletteOpen(false)
        }}
      >
        <div className="flex items-center border-b border-slate-100 px-4">
          <Search className="h-5 w-5 text-slate-400 mr-3" />
          <Command.Input 
            autoFocus
            placeholder="Type to search students, rooms, or actions..." 
            className="flex-1 h-16 bg-transparent outline-none text-slate-900 placeholder:text-slate-400 font-medium text-lg"
            value={search}
            onValueChange={setSearch}
          />
          {loading && <Loader2 className="h-5 w-5 text-primary animate-spin ml-3" />}
          <div className="hidden sm:flex items-center gap-1.5 ml-4 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-black text-slate-400">ESC</span>
          </div>
        </div>

        <Command.List className="max-h-[450px] overflow-y-auto p-2 scroll-smooth">
          <Command.Empty className="py-12 text-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
                <Sparkles className="h-8 w-8 text-primary" />
                <p className="text-sm font-bold text-slate-500">No results found for your search.</p>
            </div>
          </Command.Empty>

          {/* Quick Actions */}
          {search.length === 0 && (
            <Command.Group heading="Quick Actions" className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <Command.Item 
                onSelect={() => runCommand(() => navigate('/gate-passes'))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-default select-none aria-selected:bg-blue-50 aria-selected:text-blue-600 transition-colors"
               >
                 <Pass className="h-5 w-5" />
                 <span className="font-bold text-sm">Issue New Gate Pass</span>
               </Command.Item>
               <Command.Item 
                onSelect={() => runCommand(() => navigate('/users'))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-default select-none aria-selected:bg-blue-50 aria-selected:text-blue-600 transition-colors"
               >
                 <User className="h-5 w-5" />
                 <span className="font-bold text-sm">Manage Students</span>
               </Command.Item>
               <Command.Item 
                onSelect={() => runCommand(() => navigate('/rooms'))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-default select-none aria-selected:bg-blue-50 aria-selected:text-blue-600 transition-colors"
               >
                 <Door className="h-5 w-5" />
                 <span className="font-bold text-sm">Room Occupancy Details</span>
               </Command.Item>
            </Command.Group>
          )}

          {/* Dynamic Search Results */}
          {results.length > 0 && (
              Object.entries(
                  results.reduce((acc, curr) => {
                      if (!acc[curr.category]) acc[curr.category] = []
                      acc[curr.category].push(curr)
                      return acc
                  }, {} as Record<string, SearchResult[]>)
              ).map(([category, items]) => (
                <Command.Group key={category} heading={category} className="px-2 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {(items as SearchResult[]).map((item) => (
                    <Command.Item
                      key={`${item.category}-${item.id}`}
                      onSelect={() => runCommand(() => item.url && navigate(item.url))}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-default select-none aria-selected:bg-primary/5 aria-selected:text-primary transition-colors group"
                    >
                      <div className="h-10 w-10 bg-slate-50 group-aria-selected:bg-primary/10 rounded-xl flex items-center justify-center transition-colors">
                        {item.icon === 'user' && <User className="h-5 w-5" />}
                        {item.icon === 'door' && <Door className="h-5 w-5" />}
                        {item.icon === 'pass' && <Pass className="h-5 w-5" />}
                        {item.icon === 'alert' && <Alert className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{item.title}</span>
                        <span className="text-xs opacity-60 font-medium">{item.subtitle}</span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))
          )}
        </Command.List>

        <div className="border-t border-slate-50 px-4 py-3 bg-slate-50/50 flex items-center justify-between">
           <div className="flex gap-4">
              <div className="flex items-center gap-1.5 opacity-50">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold">{shortcutText}</kbd>
                <span className="text-[10px] font-bold">Open</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-50">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold">↵</kbd>
                <span className="text-[10px] font-bold">Select</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-50">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold">↑↓</kbd>
                <span className="text-[10px] font-bold">Navigate</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">CampusCore Global Search</span>
           </div>
        </div>
        <p id="command-palette-shortcuts" className="sr-only">
          Keyboard shortcuts: Press {shortcutText} to open global search, arrow keys to navigate results, Enter to select, and Escape to close.
        </p>
      </Command>
    </div>
  )
}
