'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight, IconPlus, IconClock, IconCheck } from '@tabler/icons-react'

const EVENT_COLORS: Record<string, string> = {
  compliance:      'var(--zn-danger)',
  meeting:         'var(--zn-gold)',
  client_review:   'var(--zn-warning)',
  workflow_task:   '#3B82F6',
  task:            '#3B82F6',
  manual:          'var(--zn-silver)',
}

const EVENT_LABELS: Record<string, string> = {
  compliance:    'Filing',
  meeting:       'Meeting',
  client_review: 'Review',
  workflow_task: 'Workflow',
  task:          'Task',
  manual:        'Event',
}

function CalendarGrid({ year, month, events, onDayClick }: {
  year: number; month: number; events: any[]; onDayClick: (day: number) => void
}) {
  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const eventsByDay: Record<number, any[]> = {}
  events.forEach(event => {
    const d = new Date(event.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push(event)
    }
  })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div>
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zn-text-3">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="h-24" />
          const dayEvents = eventsByDay[day] ?? []
          const todayClass = isToday(day)
          return (
            <div
              key={day}
              onClick={() => onDayClick(day)}
              className={cn(
                'h-24 rounded-lg border p-1.5 cursor-pointer transition-all hover:shadow-sm',
                todayClass
                  ? 'border-[var(--zn-gold)] bg-[var(--zn-gold-bg)]'
                  : 'border-zn-border bg-white hover:border-zn-border-2',
              )}
            >
              <div className={cn(
                'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold',
                todayClass ? 'bg-[var(--zn-gold)] text-white' : 'text-zn-text-2',
              )}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev, idx) => (
                  <div
                    key={idx}
                    className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                    style={{ background: EVENT_COLORS[ev.type] ?? 'var(--zn-silver)' }}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-zn-text-3">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const from = new Date(year, month, 1).toISOString()
  const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

  const { data: events = [], isLoading } = trpc.calendar.listEvents.useQuery({ from, to })
  const { data: upcoming = [] } = trpc.calendar.upcoming.useQuery()

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const monthName = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const selectedEvents = selectedDay
    ? (events as any[]).filter(e => new Date(e.date).getDate() === selectedDay)
    : []

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[12px] text-zn-text-3">{(events as any[]).length} events this month</p>
        <button className="btn-gold btn-sm flex items-center gap-1.5">
          <IconPlus size={13} /> Add event
        </button>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-4">
        {/* Calendar */}
        <div className="card">
          <div className="card-header">
            <button onClick={prevMonth} className="btn-ghost p-1.5">
              <IconChevronLeft size={15} />
            </button>
            <span className="card-title flex-1 text-center text-[13px] font-semibold text-zn-text-1 uppercase tracking-wide">
              {monthName}
            </span>
            <button onClick={nextMonth} className="btn-ghost p-1.5">
              <IconChevronRight size={15} />
            </button>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center text-[12px] text-zn-text-3">
                Loading calendar...
              </div>
            ) : (
              <CalendarGrid
                year={year}
                month={month}
                events={events as any[]}
                onDayClick={d => setSelectedDay(selectedDay === d ? null : d)}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Selected day events */}
          {selectedDay && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  {new Date(year, month, selectedDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {selectedEvents.length === 0 ? (
                <div className="px-4 py-5 text-center text-[12px] text-zn-text-3">No events</div>
              ) : (
                selectedEvents.map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                    <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: EVENT_COLORS[ev.type] ?? 'var(--zn-silver)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-zn-text-1 truncate">{ev.title}</div>
                      {ev.clientName && (
                        <div className="text-[11px] text-zn-text-3 mt-0.5">{ev.clientName}</div>
                      )}
                      <div className="text-[11px] text-zn-text-3 flex items-center gap-1 mt-0.5">
                        <IconClock size={10} />
                        {new Date(ev.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="pill-ghost pill text-[10px]">
                      {EVENT_LABELS[ev.type] ?? ev.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Upcoming 30 days */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upcoming (60 days)</span>
            </div>
            {(upcoming as any[]).length === 0 ? (
              <div className="px-4 py-5 text-center text-[12px] text-zn-text-3">Nothing scheduled</div>
            ) : (
              (upcoming as any[]).slice(0, 8).map((ev: any) => {
                const date    = new Date(ev.due_at)
                const daysAway = Math.ceil((date.getTime() - Date.now()) / 86400000)
                return (
                  <div key={ev.id} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                    <div
                      className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg text-center"
                      style={{ background: (EVENT_COLORS[ev.event_type] ?? 'var(--zn-gold)') + '15' }}
                    >
                      <div className="text-[9px] font-bold uppercase"
                        style={{ color: EVENT_COLORS[ev.event_type] ?? 'var(--zn-gold-dark)' }}>
                        {date.toLocaleString('en-US', { month: 'short' })}
                      </div>
                      <div className="text-[14px] font-semibold leading-none"
                        style={{ color: EVENT_COLORS[ev.event_type] ?? 'var(--zn-gold-dark)' }}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-zn-text-1 truncate">{ev.title}</div>
                      <div className="text-[10px] text-zn-text-3 mt-0.5">
                        {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Legend */}
          <div className="card">
            <div className="card-header"><span className="card-title">Legend</span></div>
            <div className="px-4 py-3 space-y-2">
              {Object.entries(EVENT_LABELS).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: EVENT_COLORS[type] ?? 'var(--zn-silver)' }} />
                  <span className="text-[12px] text-zn-text-2">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
