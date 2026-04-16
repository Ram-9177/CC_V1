import type { GatePass } from '@/types'

export type GatePassListResponse = { results?: GatePass[]; next?: string | null } | GatePass[]

export type GatePassView = 'overview' | 'history'
