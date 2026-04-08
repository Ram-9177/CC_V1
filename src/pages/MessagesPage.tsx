import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Plus, Send, Inbox, ArrowUpRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRealtimeQuery } from '@/hooks/useWebSocket'
import { useMessagesList, useBroadcasts, useSendMessage, useMarkMessageAsRead } from '@/hooks/features/useMessages'

interface UserOption {
  id: number
  name: string
  username: string
  role: string
}

interface MessageItem {
  id: number
  sender: number
  sender_details?: UserOption
  recipient: number
  recipient_details?: UserOption
  subject: string
  body: string
  is_read: boolean
  read_at?: string | null
  created_at: string
}

interface BroadcastItem {
  id: number
  sender: number
  sender_details?: UserOption
  subject: string
  body: string
  target_audience: string
  created_at: string
}

import { useAuthStore } from '@/lib/store'


export default function MessagesPage() {
  useRealtimeQuery('messages_updated', 'messages')
  useRealtimeQuery('broadcast_created', 'broadcasts')

  const [composeOpen, setComposeOpen] = useState(false)
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox')
  const [recipientId, setRecipientId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isBroadcast, setIsBroadcast] = useState(false)
  const [targetAudience, setTargetAudience] = useState('all_students')
  
  const currentUser = useAuthStore(state => state.user)

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['message-users'],
    queryFn: async () => {
      const response = await api.get('/auth/users/')
      return response.data.results || response.data
    },
    select: (data) => {
        const role = currentUser?.role;
        if (!role) return data;
        if (role === 'student') {
          return data.filter((u) => ['warden', 'head_warden'].includes(u.role));
        }
        if (['admin', 'super_admin', 'warden', 'head_warden', 'security_head'].includes(role)) {
           return data;
        }
        return data.filter((u) => u.role !== 'student');
    }
  })

  const { data: messages, isLoading } = useMessagesList<MessageItem>(box)

  const { data: broadcasts, isLoading: broadcastsLoading } = useBroadcasts<BroadcastItem>()

  const unreadCount = useMemo(() => {
    if (!messages) return 0
    return messages.filter((m) => !m.is_read).length
  }, [messages])

  const sendHook = useSendMessage()
  const sendMutation = {
    ...sendHook,
    mutate: () => {
      const payload: Record<string, unknown> = isBroadcast
        ? { _broadcast: true, subject, body, target_audience: targetAudience }
        : { recipient: Number(recipientId), subject, body }
      if (!isBroadcast && !recipientId) {
        toast.error('Recipient is required')
        return
      }
      sendHook.mutate(payload, {
        onSuccess: () => {
          toast.success(isBroadcast ? 'Broadcast sent' : 'Message sent')
          setComposeOpen(false)
          setRecipientId('')
          setSubject('')
          setBody('')
          setIsBroadcast(false)
          if (!isBroadcast) setBox('sent')
        },
        onError: (error: unknown) => {
          toast.error(getApiErrorMessage(error, `Failed to send ${isBroadcast ? 'broadcast' : 'message'}`))
        },
      })
    },
  }

  const markReadHook = useMarkMessageAsRead()
  const markReadMutation = {
    ...markReadHook,
    mutate: (id: number) => {
      markReadHook.mutate(id, {
        onError: (error: unknown) => {
          toast.error(getApiErrorMessage(error, 'Failed to mark as read'))
        },
      })
    },
  }

  const userOptions = useMemo(() => {
    if (!users) return []
    return users
      .map((u) => ({
        id: u.id,
        name: u.name || u.username,
        username: u.username,
        role: u.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users])

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black flex items-center gap-2 tracking-tight">
            <div className="p-2 bg-primary/10 rounded-sm text-primary">
                <Mail className="h-6 w-6" />
            </div>
            Messages
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Send and receive in-app messages</p>
        </div>
        <div className="flex gap-2">
            {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'warden' || currentUser?.role === 'head_warden') && (
               <Button onClick={() => { setIsBroadcast(true); setComposeOpen(true); }} variant="outline" className="rounded-sm h-12 px-6 border-primary/20 text-primary font-bold hover:bg-primary/5 shadow-sm">
                  <Send className="h-5 w-5 mr-2" />
                  New Broadcast
               </Button>
            )}
            <Button onClick={() => { setIsBroadcast(false); setComposeOpen(true); }} className="rounded-sm h-12 px-6 primary-gradient text-white font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
              <Plus className="h-5 w-5 mr-2" />
              New Message
            </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-sm border-0 shadow-sm bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-blue-400">Inbox</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-blue-900 flex items-center gap-2">
              <Inbox className="h-6 w-6 text-blue-300" />
              {box === 'inbox' ? messages?.length || 0 : '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-sm border-0 shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-primary/60">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-primary">{box === 'inbox' ? unreadCount : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={box} onValueChange={(value) => setBox(value as 'inbox' | 'sent')}>
        <TabsList className="bg-slate-100 p-1 rounded-sm border border-slate-200">
          <TabsTrigger value="inbox" className="rounded-sm px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Inbox</TabsTrigger>
          <TabsTrigger value="sent" className="rounded-sm px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Sent</TabsTrigger>
          <TabsTrigger value="broadcasts" className="rounded-sm px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Broadcasts</TabsTrigger>
        </TabsList>
        <TabsContent value={box} className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="font-bold">Loading messages...</p>
              </CardContent>
            </Card>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => {
                const counterparty =
                  box === 'inbox' ? message.sender_details : message.recipient_details
                return (
                  <Card key={message.id} className={`rounded-sm border-0 shadow-sm transition-all hover:shadow-md ${!message.is_read && box === 'inbox' ? 'bg-primary/5 ring-2 ring-primary/20' : 'bg-white'}`}>
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            {!message.is_read && box === 'inbox' && (
                                <div className="h-2 w-2 rounded-sm bg-primary animate-pulse" />
                            )}
                            <Badge variant="outline" className="rounded-sm bg-neutral-100/50 border-0 text-neutral-500 font-bold text-[10px]">
                              {box === 'inbox' ? 'From' : 'To'} {counterparty?.name || 'Unknown'}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg font-bold text-foreground leading-tight">
                            {message.subject || 'No subject'}
                          </CardTitle>
                        </div>
                        {box === 'inbox' && !message.is_read && (
                          <div className="flex gap-2">
                             <Button
                               size="sm"
                               className="rounded-sm bg-white text-primary border border-primary/20 hover:bg-primary/10 font-bold text-xs h-8"
                               onClick={() => markReadMutation.mutate(message.id)}
                               disabled={markReadMutation.isPending}
                             >
                               Mark Read
                             </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className={`text-sm text-foreground/80 whitespace-pre-line p-4 rounded-sm ${!message.is_read && box === 'inbox' ? 'bg-white/60' : 'bg-neutral-50'}`}>
                        {message.body}
                      </div>
                      <div className="flex justify-end items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        <div className="flex items-center gap-1 bg-neutral-100 px-2 py-1 rounded-sm">
                          <ArrowUpRight className="h-3 w-3" />
                          <span>{new Date(message.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-muted p-4 rounded-sm mb-4">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No messages</h3>
                <p className="text-muted-foreground">
                  {box === 'inbox' ? "You haven't received any messages yet." : "You haven't sent any messages yet."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="broadcasts" className="mt-4">
          {broadcastsLoading ? (
             <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
             </Card>
          ) : broadcasts && broadcasts.length > 0 ? (
            <div className="space-y-4">
              {broadcasts.map((broadcast) => (
                <Card key={broadcast.id} className="rounded-sm border-0 shadow-sm bg-gradient-to-br from-primary/5 to-white ring-1 ring-primary/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <Badge className="bg-primary text-black font-black uppercase tracking-tighter rounded-sm px-3">Broadcast</Badge>
                         <Badge variant="outline" className="border-primary/20 text-primary font-bold">To: {broadcast.target_audience.replace('_', ' ')}</Badge>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(broadcast.created_at).toLocaleDateString()}</span>
                    </div>
                    <CardTitle className="text-xl font-black mt-3">{broadcast.subject}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-white/80 p-4 rounded-sm text-sm font-medium leading-relaxed">
                      {broadcast.body}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary/60">
                      <div className="h-6 w-6 rounded-sm bg-primary/20 flex items-center justify-center text-[10px]">
                         {broadcast.sender_details?.name?.[0] || 'A'}
                      </div>
                      Sent by {broadcast.sender_details?.name || 'Admin'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
             <Card className="rounded-sm border-0 shadow-sm">
                <CardContent className="py-12 flex flex-col items-center">
                   <div className="h-12 w-12 rounded-sm bg-slate-50 flex items-center justify-center mb-4">
                      <Send className="h-6 w-6 text-slate-300" />
                   </div>
                   <p className="font-bold text-slate-400">No active broadcasts for you</p>
                </CardContent>
             </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={composeOpen} onOpenChange={(val) => { setComposeOpen(val); if(!val) setIsBroadcast(false); }}>
        <DialogContent className="max-w-lg rounded-sm border-none p-0 overflow-hidden bg-white">
          <div className={`p-6 bg-gradient-to-br ${isBroadcast ? 'from-primary/10 to-transparent' : 'from-blue-50 to-transparent'}`}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                {isBroadcast ? <Send className="h-6 w-6 text-primary" /> : <Plus className="h-6 w-6 text-blue-500" />}
                {isBroadcast ? 'Create Broadcast' : 'New Direct Message'}
              </DialogTitle>
              <DialogDescription className="font-medium">
                {isBroadcast ? 'Publish an announcement to a segment of students' : 'Send a private message to another user.'}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-5">
            {!isBroadcast && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Recipient *</label>
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger className="h-12 rounded-sm border-0 bg-slate-50 focus:ring-primary px-4 font-medium">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-none shadow-2xl">
                    {userOptions.length === 0 ? (
                      <div className="p-4 text-sm text-center text-muted-foreground font-black">
                        No valid recipients found
                      </div>
                    ) : (
                      userOptions.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)} className="rounded-sm my-1 font-medium">
                          {user.name} ({user.role?.replace('_', ' ') || 'Staff'})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {isBroadcast && (
               <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Target Audience *</label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                     <SelectTrigger className="h-12 rounded-sm border-0 bg-slate-50 focus:ring-primary px-4 font-medium">
                        <SelectValue placeholder="Who should see this?" />
                     </SelectTrigger>
                     <SelectContent className="rounded-sm border-none shadow-2xl">
                        <SelectItem value="all_students" className="rounded-sm my-1 font-medium">All Students</SelectItem>
                        <SelectItem value="hostellers" className="rounded-sm my-1 font-medium">Hostellers Only</SelectItem>
                        <SelectItem value="day_scholars" className="rounded-sm my-1 font-medium">Day Scholars Only</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Subject *</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={isBroadcast ? "Urgent Announcement..." : "How can I help you?"} className="h-12 rounded-sm border-0 bg-slate-50 focus-visible:ring-primary px-4 font-medium" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Message Body *</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your full message here..." className="rounded-sm border-0 bg-slate-50 focus-visible:ring-primary p-4 font-medium min-h-[120px]" />
            </div>
          </div>
          <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
            <Button onClick={() => {
              if (!isBroadcast && !recipientId.trim()) {
                toast.error('Please select a recipient');
                return;
              }
              if (!subject.trim()) {
                toast.error('Subject is required');
                return;
              }
              if (!body.trim()) {
                toast.error('Message body is required');
                return;
              }
              sendMutation.mutate();
            }} disabled={sendMutation.isPending} className="w-full h-14 primary-gradient text-white font-black uppercase tracking-widest rounded-sm shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all">
              {sendMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {isBroadcast ? 'Publish Broadcast' : 'Send Private Message'}
            </Button>
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => { setComposeOpen(false); setIsBroadcast(false); }}>
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
