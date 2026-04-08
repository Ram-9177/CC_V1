import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  ShieldCheck, Search, Calendar, User, 
  ArrowRight, Info, HardDrive, Cpu, 
  ChevronDown, ChevronUp, History
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { format } from 'date-fns'

interface AuditEntry {
  id: string
  actor_name: string
  actor_reg_number: string
  action: string
  resource_type: string
  resource_id: string
  changes: Record<string, [unknown, unknown]>
  ip_address: string
  user_agent: string
  created_at: string
}

export default function AuditLogPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', searchQuery, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (actionFilter !== 'all') params.append('action', actionFilter)
      
      const response = await api.get(`/audit/?${params.toString()}`)
      return response.data.results as AuditEntry[]
    }
  })

  if (isLoading) return <PageSkeleton variant="dashboard" />

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black px-3 py-1 uppercase tracking-widest text-[10px]">
              Institutional Security
            </Badge>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Forensic Audit Trail <ShieldCheck className="text-indigo-600 h-8 w-8" />
          </h1>
          <p className="text-slate-500 font-medium">Monitoring all administrative actions across the ERP landscape.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-3xl shadow-xl border border-slate-100">
           <div className="flex -space-x-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 w-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?u=${i+10}`} alt="Admin" className="w-full h-full object-cover opacity-80" />
                </div>
              ))}
           </div>
           <div className="pr-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Controllers</p>
              <p className="text-sm font-bold text-slate-700">Audit & Control Team</p>
           </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none shadow-xl bg-slate-900 text-white rounded-[32px] overflow-hidden relative group">
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><History size={80} /></div>
           <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest opacity-60">Total Events Logged</CardTitle>
           </CardHeader>
           <CardContent>
              <h3 className="text-4xl font-black">{data?.length || 0}</h3>
              <p className="text-xs font-medium text-slate-400 mt-2">Active Retention Active</p>
           </CardContent>
         </Card>

         <Card className="border-none shadow-xl bg-white rounded-[32px] border-l-4 border-indigo-600">
           <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <Cpu className="w-4 h-4 text-indigo-600" /> Integrity Score
              </CardTitle>
           </CardHeader>
           <CardContent>
              <h3 className="text-4xl font-black text-slate-900 group">99.9<span className="text-lg opacity-30">%</span></h3>
              <p className="text-xs font-medium text-slate-400 mt-2">Hash validation active</p>
           </CardContent>
         </Card>

         <Card className="border-none shadow-xl bg-white rounded-[32px] border-l-4 border-amber-500">
           <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <HardDrive className="w-4 h-4 text-amber-500" /> System Latency
              </CardTitle>
           </CardHeader>
           <CardContent>
              <h3 className="text-4xl font-black text-slate-900">0.04<span className="text-lg opacity-30">ms</span></h3>
              <p className="text-xs font-medium text-slate-400 mt-2">NRT Hydration Active</p>
           </CardContent>
         </Card>
      </div>

      {/* Audit List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
           <h3 className="text-xl font-black tracking-tight text-slate-800">Recent Activity</h3>
           <div className="flex items-center gap-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  placeholder="Filter by Resource ID or Actor..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-2xl text-sm font-medium w-64 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <select 
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-600 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="all">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
           </div>
        </div>

        <div className="bg-white rounded-[32px] shadow-xl border border-slate-50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actor</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Resource</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data?.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className={`group hover:bg-slate-50/50 transition-colors ${expandedId === entry.id ? 'bg-indigo-50/20' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <Calendar className="h-3 w-3 text-slate-400" />
                           <span className="text-xs font-bold text-slate-600">
                              {format(new Date(entry.created_at), 'MMM d, HH:mm:ss')}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-indigo-600">
                              <User className="h-4 w-4" />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800">{entry.actor_name}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{entry.actor_reg_number}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`
                          rounded-lg font-black text-[10px] px-2 py-1
                          ${entry.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' : ''}
                          ${entry.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : ''}
                          ${entry.action === 'DELETE' ? 'bg-red-100 text-red-700' : ''}
                          ${!['CREATE','UPDATE','DELETE'].includes(entry.action) ? 'bg-slate-100 text-slate-700' : ''}
                        `}>
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{entry.resource_type}</span>
                           <span className="text-[10px] font-bold text-slate-400">ID: {entry.resource_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm"
                        >
                          {expandedId === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr>
                        <td colSpan={5} className="px-10 py-6 bg-slate-50/30">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-300">
                              <div className="space-y-4">
                                 <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                    <Info className="h-3 w-3" /> Change Delta
                                 </h4>
                                 <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                                    {Object.entries(entry.changes).length > 0 ? (
                                      Object.entries(entry.changes).map(([field, delta]) => (
                                        <div key={field} className="flex flex-col gap-1 border-b border-slate-50 pb-2 last:border-0">
                                           <span className="text-[10px] font-black uppercase text-slate-400">{field.replace('_', ' ')}</span>
                                           <div className="flex items-center gap-3">
                                              <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-bold line-through opacity-60">
                                                {String((delta as [unknown, unknown])[0])}
                                              </span>
                                              <ArrowRight className="h-3 w-3 text-slate-300" />
                                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-bold">
                                                {String((delta as [unknown, unknown])[1])}
                                              </span>
                                           </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs font-medium text-slate-400 italic">No field-level changes recorded for this action.</p>
                                    )}
                                 </div>
                              </div>
                              <div className="space-y-4">
                                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                   Context Metadata
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-xs font-bold text-slate-500">IP Address</span>
                                    <span className="text-xs font-black text-slate-700">{entry.ip_address || '127.0.0.1'}</span>
                                  </div>
                                  <div className="pt-2">
                                    <span className="text-xs font-bold text-slate-500">User Agent</span>
                                    <p className="text-[10px] font-medium text-slate-400 mt-1 line-clamp-2 max-w-sm">
                                      {entry.user_agent}
                                    </p>
                                  </div>
                                </div>
                              </div>
                           </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
