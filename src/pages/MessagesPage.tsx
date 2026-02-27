import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  DialogFooter,
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

import { useAuthStore } from '@/lib/store'

// ... existing imports

export default function MessagesPage() {
  useRealtimeQuery('messages_updated', 'messages')

  const queryClient = useQueryClient()
  const [composeOpen, setComposeOpen] = useState(false)
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox')
  const [recipientId, setRecipientId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  
  const currentUser = useAuthStore(state => state.user)

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['message-users'],
    queryFn: async () => {
      const response = await api.get('/auth/users/')
      return response.data.results || response.data
    },
    // Customize selectivity:
    select: (data) => {
        const role = currentUser?.role;
        if (!role) return data;

        // Student: Can ONLY see Warden and Head Warden
        if (role === 'student') {
          return data.filter((u) => ['warden', 'head_warden'].includes(u.role));
        }

        // Authorities (Admin, Warden, etc) can see everyone.
        if (['admin', 'super_admin', 'warden', 'head_warden', 'security_head'].includes(role)) {
           return data;
        }

        // Other roles (Chef, etc) shouldn't see students usually
        return data.filter((u) => u.role !== 'student');
    }
  })

  const { data: messages, isLoading } = useQuery<MessageItem[]>({
    queryKey: ['messages', box],
    queryFn: async () => {
      const response = await api.get(`/messages/?box=${box}`)
      return response.data.results || response.data
    },
  })

  const unreadCount = useMemo(() => {
    if (!messages) return 0
    return messages.filter((m) => !m.is_read).length
  }, [messages])

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!recipientId) throw new Error('Recipient is required')
      await api.post('/messages/', {
        recipient: Number(recipientId),
        subject,
        body,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast.success('Message sent')
      setComposeOpen(false)
      setRecipientId('')
      setSubject('')
      setBody('')
      setBox('sent')
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to send message'))
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/messages/${id}/mark_read/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark as read'))
    },
  })

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
            <div className="p-2 bg-indigo-100 rounded-2xl text-indigo-600">
                <Mail className="h-6 w-6" />
            </div>
            Messages
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Send and receive in-app messages</p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="rounded-full h-12 px-6 primary-gradient text-white font-bold shadow-lg shadow-indigo-200 hover:scale-105 transition-transform">
          <Plus className="h-5 w-5 mr-2" />
          New Message
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl border-0 shadow-sm bg-blue-50/50">
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
        <Card className="rounded-3xl border-0 shadow-sm bg-indigo-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-indigo-400">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-indigo-900">{box === 'inbox' ? unreadCount : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={box} onValueChange={(value) => setBox(value as 'inbox' | 'sent')}>
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
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
                  <Card key={message.id} className={`rounded-3xl border-0 shadow-sm transition-all hover:shadow-md ${!message.is_read && box === 'inbox' ? 'bg-indigo-50 ring-2 ring-indigo-100' : 'bg-white'}`}>
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            {!message.is_read && box === 'inbox' && (
                                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                            )}
                            <Badge variant="outline" className="rounded-lg bg-neutral-100/50 border-0 text-neutral-500 font-bold text-[10px]">
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
                               className="rounded-full bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 font-bold text-xs h-8"
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
                      <div className={`text-sm text-foreground/80 whitespace-pre-line p-4 rounded-2xl ${!message.is_read && box === 'inbox' ? 'bg-white/60' : 'bg-neutral-50'}`}>
                        {message.body}
                      </div>
                      <div className="flex justify-end items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        <div className="flex items-center gap-1 bg-neutral-100 px-2 py-1 rounded-lg">
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
                <div className="bg-muted p-4 rounded-full mb-4">
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
      </Tabs>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>Send a message to another user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient</label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.length === 0 ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">
                      No valid recipients found
                    </div>
                  ) : (
                    userOptions.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-black text-foreground font-bold hover:bg-muted" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (!recipientId.trim()) {
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
            }} disabled={sendMutation.isPending} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
