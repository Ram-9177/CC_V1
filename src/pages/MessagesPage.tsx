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
    // Customize selectivity if needed:
    select: (data) => {
        // Enforce: students can communicate only with warden/head_warden.
        if (currentUser?.role === 'student') {
          return data.filter((u) => ['warden', 'head_warden'].includes(u.role))
        }

        // Non-warden roles shouldn't see students as recipients (backend blocks it too).
        if (currentUser?.role && !['warden', 'head_warden'].includes(currentUser.role)) {
          return data.filter((u) => u.role !== 'student')
        }

        return data
    }
  })

  const { data: messages, isLoading } = useQuery<MessageItem[]>({
    queryKey: ['messages', box],
    queryFn: async () => {
      const response = await api.get(`/messages/messages/?box=${box}`)
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
      await api.post('/messages/messages/', {
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
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to send message'))
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/messages/messages/${id}/mark_read/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] })
    },
    onError: (error: any) => {
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Messages
          </h1>
          <p className="text-muted-foreground">Send and receive in-app messages</p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inbox</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              {box === 'inbox' ? messages?.length || 0 : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{box === 'inbox' ? unreadCount : '—'}</div>
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
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#25343F] mb-2\" />
                <p className="text-muted-foreground">Loading messages...</p>
              </CardContent>
            </Card>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => {
                const counterparty =
                  box === 'inbox' ? message.sender_details : message.recipient_details
                return (
                  <Card key={message.id} className={message.is_read || box === 'sent' ? '' : 'border-primary'}>
                    <CardHeader className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <CardTitle className="text-lg">
                            {message.subject || 'No subject'}
                          </CardTitle>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">
                              {box === 'inbox' ? 'From' : 'To'} {counterparty?.name || 'Unknown'}
                            </Badge>
                            {!message.is_read && box === 'inbox' && (
                              <Badge className="bg-[#FF9B51] text-white">Unread</Badge>
                            )}
                          </div>
                        </div>
                        {box === 'inbox' && !message.is_read && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markReadMutation.mutate(message.id)}
                            disabled={markReadMutation.isPending}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{message.body}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <ArrowUpRight className="h-3 w-3" />
                        {new Date(message.created_at).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                )}
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium mb-1">No messages found</p>
                <p className="text-sm text-muted-foreground">Your messages will appear here</p>
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
                  {userOptions.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
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
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
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
            }} disabled={sendMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
