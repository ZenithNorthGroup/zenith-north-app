'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn, formatDate, daysUntil } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react'

// ── Event type config ──────────────────────────────────────

const EVENT_CONFIG = {
  compliance:     { dot: 'bg-zn-danger',  pill: 'pill-danger',  label: 'Filing' },
  client_review:  { dot: 'bg-zn-warning', pill: 'pill-warn',    label: 'Review' },
  workflow_task:  { dot: 'bg-zn-gold',    pill: 'pill-gold',    label: 'Task' },
  meeting:        { dot: 'bg-zn-text-2',  pill: 'pill-ghost',   label: 'Meeting' },
}

// ── Calendar grid ──────────────────────────────────────────

function CalendarGrid({ year, month, events }: {
  year: number; month: number; events: any[]
}) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => {
    if (i < firstDay) return null
    return i - firstDay + 1
  })

  const eventsByDay: Record<number, any[]> = {}
  events.forEach(event => {
    const d = new Date(event.dueAt)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push(event)
    }
  })

  return (
    <div>
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center font-mono text-[10px] uppercase tracking-wider text-zn-text-3">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="h-20 rounded border border-zn-border/30" />

          const isToday = day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()

          const dayEvents = eventsByDay[day] ?? []

          return (
            <div
              key={i}
              className={cn(
                'h-20 rounded border p-1.5 transition-colors',
                isToday
                  ? 'border-zn-gold/40 bg-zn-gold/8'
                  : 'border-zn-border hover:border-zn-border-2',
              )}
            >
              <div className={cn(
                'mb-1 font-mono text-[11px] font-medium',
                isToday ? 'text-zn-gold' : 'text-zn-text-2',
              )}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((event: any) => {
                  const config = EVENT_CONFIG[event.eventType as keyof typeof EVENT_CONFIG]
                    ?? EVENT_CONFIG.meeting
                  return (
                    <div
                      key={event.id}
                      className="truncate rounded px-1 py-0.5 font-mono text-[9px]"
                      style={{ background: 'var(--color-background-secondary)' }}
                    >
                      <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle', config.dot)} />
                      <span className="text-zn-text-2">{event.title}</span>
                    </div>
                  )
                })}
                {dayEvents.length > 2 && (
                  <div className="font-mono text-[9px] text-zn-text-3 px-1">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Upcoming list ──────────────────────────────────────────

function UpcomingEvent({ event }: { event: any }) {
  const config = EVENT_CONFIG[event.eventType as keyof typeof EVENT_CONFIG]
    ?? EVENT_CONFIG.meeting
  const days = daysUntil(event.dueAt)
  const isOverdue = days < 0
  const isSoon = days >= 0 && days <= 14

  return (
    <div className="flex items-center gap-3 border-b border-zn-border py-3 last:border-0">
      <div className={cn('h-2 w-2 flex-shrink-0 rounded-full', config.dot)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zn-text-1 truncate">{event.title}</div>
        <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">
          {formatDate(event.dueAt).toUpperCase()}
          {' · '}
          {event.eventType.replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>
      <span className={cn(
        'pill flex-shrink-0',
        isOverdue ? 'pill-danger' : isSoon ? 'pill-warn' : 'pill-ghost',
      )}>
        {isOverdue
          ? `${Math.abs(days)}d overdue`
          : days === 0
          ? 'Today'
          : `${days}d`
        }
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  // In production: fetch from calendarEvents via tRPC
  const events: any[] = [] // wire to real data

  const { data: complianceData } = trpc.compliance.dashboard.useQuery()
  const filings = complianceData?.filings ?? []

  // Merge compliance filings into calendar events
  const allEvents = [
    ...events,
    ...filings.map(f => ({
      ...f,
      eventType: 'compliance',
    })),
  ]

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Upcoming events (next 60 days)
  const upcomingEvents = allEvents
    .filter(e => {
      const d = daysUntil(e.dueAt)
      return d >= -7 && d <= 60
    })
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
            Calendar
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            SEC FILINGS · ANNUAL REVIEWS · WORKFLOW TASKS · CLIENT MEETINGS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-zn-border overflow-hidden">
            {['calendar', 'list'].map(v => (
              <button
                key={v}
                onClick={() => setView(v as 'calendar' | 'list')}
                className={cn(
                  'px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition-all',
                  view === v
                    ? 'bg-zn-gold/10 text-zn-gold'
                    : 'text-zn-text-3 hover:text-zn-text-2',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn-ghost btn-sm flex items-center gap-1.5">
            <IconPlus size={12} /> Add event
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-4">
        {Object.entries(EVENT_CONFIG).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', config.dot)} />
            <span className="font-mono text-[10px] text-zn-text-3">
              {config.label}
            </span>
          </div>
        ))}
      </div>

      {view === 'calendar' ? (
        <div className="grid grid-cols-3 gap-4">
          {/* Main calendar */}
          <div className="col-span-2 card p-4">
            {/* Month nav */}
            <div className="mb-4 flex items-center justify-between">
              <button onClick={prevMonth} className="btn-ghost p-1.5">
                <IconChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-zn-text-1">
                {MONTHS[month]} {year}
              </span>
              <button onClick={nextMonth} className="btn-ghost p-1.5">
                <IconChevronRight size={16} />
              </button>
            </div>
            <CalendarGrid year={year} month={month} events={allEvents} />
          </div>

          {/* Upcoming sidebar */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upcoming — 60 days</span>
              <span className="font-mono text-[10px] text-zn-text-3">
                {upcomingEvents.length} events
              </span>
            </div>
            <div className="px-4">
              {upcomingEvents.length === 0 ? (
                <div className="py-8 text-center font-mono text-[11px] text-zn-text-3">
                  No upcoming events
                </div>
              ) : (
                upcomingEvents.map(event => (
                  <UpcomingEvent key={event.id} event={event} />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="card">
          <div className="card-header">
            <span className="card-title">All upcoming events</span>
          </div>
          <div className="px-4">
            {upcomingEvents.length === 0 ? (
              <div className="py-10 text-center font-mono text-[11px] text-zn-text-3">
                No upcoming events in the next 60 days
              </div>
            ) : (
              upcomingEvents.map(event => (
                <UpcomingEvent key={event.id} event={event} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
