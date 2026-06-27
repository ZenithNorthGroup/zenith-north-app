'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import { IconPlus, IconCheck, IconAlertTriangle, IconClock } from '@tabler/icons-react'

// ── Config ─────────────────────────────────────────────────

const TYPE_CONFIG = {
  workflow:    { pill: 'pill-gold',    label: 'Workflow'   },
  compliance:  { pill: 'pill-danger',  label: 'Compliance' },
  filing:      { pill: 'pill-warn',    label: 'Filing'     },
  meeting:     { pill: 'pill-ghost',   label: 'Meeting'    },
  manual:      { pill: 'pill-ghost',   label: 'Task'       },
  flag_review: { pill: 'pill-danger',  label: 'Flag review'},
} as const

// ── Task row ───────────────────────────────────────────────

function TaskRow({ task, onComplete }: {
  task: any
  onComplete: (id: string) => void
}) {
  const daysUntil = task.daysUntil
  const isOverdue = daysUntil !== null && daysUntil < 0 && !task.done
  const isSoon    = daysUntil !== null && daysUntil >= 0 && daysUntil <= 3 && !task.done
  const typeCfg   = TYPE_CONFIG[task.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.manual

  function formatDue() {
    if (task.done) return 'Done'
    if (daysUntil === null) return 'No due date'
    if (isOverdue) return `${Math.abs(daysUntil)}d overdue`
    if (daysUntil === 0) return 'Today'
    return `${daysUntil}d`
  }

  return (
    <div className={cn(
      'flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0 transition-colors',
      task.done ? 'opacity-50' : 'hover:bg-zn-surface-2',
    )}>
      {/* Checkbox */}
      <button
        onClick={() => !task.done && onComplete(task.id)}
        disabled={task.done}
        className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all',
          task.done
            ? 'border-zn-success bg-zn-success text-zn-black cursor-default'
            : 'border-zn-border-2 bg-zn-surface-3 hover:border-zn-gold cursor-pointer',
        )}
      >
        {task.done && <IconCheck size={11} />}
      </button>

      {/* Priority dot */}
      <div className={cn(
        'h-1.5 w-1.5 flex-shrink-0 rounded-full',
        task.priority === 'high'   ? 'bg-zn-danger' :
        task.priority === 'medium' ? 'bg-zn-warning' :
        'bg-zn-text-3',
      )} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-sm font-medium',
          task.done ? 'line-through text-zn-text-3' : 'text-zn-text-1',
        )}>
          {task.title}
        </div>
        {task.clientName && (
          <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">
            {task.clientName}
          </div>
        )}
      </div>

      {/* Type */}
      <span className={cn('pill flex-shrink-0', typeCfg.pill)}>
        {typeCfg.label}
      </span>

      {/* Due */}
      <div className={cn(
        'flex items-center gap-1 font-mono text-[11px] flex-shrink-0',
        isOverdue ? 'text-zn-danger' : isSoon ? 'text-zn-warning' : 'text-zn-text-3',
      )}>
        {isOverdue && <IconAlertTriangle size={11} />}
        {!isOverdue && !task.done && daysUntil !== null && <IconClock size={11} />}
        {formatDue()}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function TasksPage() {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'done'>('all')

  const { data: tasks = [], isLoading, refetch } = trpc.tasks.list.useQuery({ filter: 'all' })
  const { data: summary } = trpc.tasks.summary.useQuery()
  const completeMutation = trpc.tasks.complete.useMutation({ onSuccess: () => refetch() })

  const filtered = tasks.filter((t: any) => {
    if (filter === 'done')    return t.done
    if (filter === 'overdue') return t.daysUntil !== null && t.daysUntil < 0 && !t.done
    if (filter === 'today')   return t.daysUntil === 0 && !t.done
    return !t.done
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">Tasks</h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            {isLoading ? 'LOADING...' : `${summary?.open ?? 0} OPEN · ${summary?.overdue ?? 0} OVERDUE`}
          </p>
        </div>
        <button className="btn-gold btn-sm flex items-center gap-1.5">
          <IconPlus size={13} /> New task
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-2.5">
        {[
          { label: 'Open',    value: summary?.open    ?? '—', filter: 'all',     cls: 'text-zn-gold'    },
          { label: 'Overdue', value: summary?.overdue ?? '—', filter: 'overdue', cls: 'text-zn-danger'  },
          { label: 'Today',   value: summary?.today   ?? '—', filter: 'today',   cls: 'text-zn-warning' },
          { label: 'Done',    value: summary?.done    ?? '—', filter: 'done',    cls: 'text-zn-success' },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setFilter(s.filter as typeof filter)}
            className={cn('stat-card cursor-pointer', filter === s.filter && 'border-zn-gold/30')}
          >
            <div className="stat-label">{s.label}</div>
            <div className={cn('stat-num', s.cls)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {filter === 'all' ? 'Open tasks' : filter === 'done' ? 'Completed tasks' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} tasks`}
          </span>
          <span className="font-mono text-[10px] text-zn-text-3">{filtered.length} tasks</span>
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
              <div className="h-5 w-5 rounded border border-zn-border bg-zn-surface-3 animate-pulse" />
              <div className="flex-1 h-3 rounded bg-zn-surface-3 animate-pulse" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center font-mono text-[11px] text-zn-text-3">
            {filter === 'done' ? 'No completed tasks yet.' : 'No tasks in this view.'}
          </div>
        ) : (
          filtered.map((task: any) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={id => completeMutation.mutate({ id })}
            />
          ))
        )}
      </div>
    </div>
  )
}
