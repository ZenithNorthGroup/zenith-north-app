'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, cn } from '@/lib/utils'
import {
  IconPlus, IconCheck, IconX, IconClock, IconLoader2,
  IconSend, IconEye, IconAlertTriangle,
} from '@tabler/icons-react'

const STATUS_CONFIG = {
  pending:            { pill: 'pill-warn',    label: 'Pending review' },
  approved:           { pill: 'pill-success', label: 'Approved' },
  rejected:           { pill: 'pill-danger',  label: 'Rejected' },
  revision_requested: { pill: 'pill-gold',    label: 'Revision needed' },
} as const

const CONTENT_TYPES = [
  { value: 'linkedin_post',  label: 'LinkedIn post' },
  { value: 'newsletter',     label: 'Email newsletter' },
  { value: 'website',        label: 'Website content' },
  { value: 'advertisement',  label: 'Advertisement' },
  { value: 'social',         label: 'Social media' },
  { value: 'email_campaign', label: 'Email campaign' },
  { value: 'other',          label: 'Other' },
]

function SubmitForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [form, setForm] = useState({
    contentType: 'linkedin_post', platform: '', title: '', body: '', scheduledFor: '',
  })
  const submitMutation = trpc.marketing.submit.useMutation({
    onSuccess: () => { onSubmitted(); onClose() }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-2xl rounded-xl border border-zn-border bg-white shadow-xl">
        <div className="card-header flex items-center justify-between">
          <span className="text-[14px] font-semibold text-zn-text-1">Submit content for approval</span>
          <button onClick={onClose}><IconX size={16} className="text-zn-text-3" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Content type</label>
              <select value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value }))} className="field-select">
                {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Platform (optional)</label>
              <input value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} placeholder="LinkedIn, Twitter..." className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">Title / subject</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Q4 Market Update — Client Newsletter" className="field-input" />
          </div>
          <div>
            <label className="field-label">Content body</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Paste the full text of the content you want reviewed..."
              rows={8}
              className="field-input resize-none"
            />
          </div>
          <div>
            <label className="field-label">Scheduled publish date (optional)</label>
            <input type="datetime-local" value={form.scheduledFor} onChange={e => setForm(f => ({ ...f, scheduledFor: e.target.value }))} className="field-input" />
          </div>
          <div className="rounded-lg p-3 text-[12px]"
            style={{ background: 'var(--zn-gold-bg)', border: '1px solid var(--zn-gold-border)' }}>
            <strong>SEC Rule 206(4)-1:</strong> All marketing materials must receive CCO approval before publication. Your submission will be reviewed within 2 business days.
          </div>
        </div>
        <div className="border-t border-zn-border px-5 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => submitMutation.mutate(form as any)}
            disabled={!form.title || !form.body || submitMutation.isPending}
            className="btn-gold flex items-center gap-1.5"
          >
            {submitMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />}
            Submit for review
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewPanel({ item, onClose, onReviewed }: { item: any; onClose: () => void; onReviewed: () => void }) {
  const { data: me } = trpc.me.getMe.useQuery()
  const reviewMutation = trpc.marketing.review.useMutation({ onSuccess: () => { onReviewed(); onClose() } })
  const [notes, setNotes] = useState('')
  const canReview = me?.isCco || me?.role === 'owner'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-2xl rounded-xl border border-zn-border bg-white shadow-xl">
        <div className="card-header flex items-center justify-between">
          <span className="text-[14px] font-semibold text-zn-text-1">{item.title}</span>
          <button onClick={onClose}><IconX size={16} className="text-zn-text-3" /></button>
        </div>
        <div className="p-5">
          <div className="mb-4 flex items-center gap-3 text-[12px] text-zn-text-3">
            <span>Submitted by <strong>{item.submitted_by_name}</strong></span>
            <span>·</span>
            <span>{formatDate(item.created_at)}</span>
            <span>·</span>
            <span className="capitalize">{item.content_type?.replace(/_/g, ' ')}</span>
          </div>
          <div className="mb-4 rounded-lg border border-zn-border bg-zn-surface-2 p-4 text-[13px] text-zn-text-1 leading-relaxed whitespace-pre-wrap">
            {item.body}
          </div>
          {item.review_notes && (
            <div className="mb-4 rounded-lg p-3 text-[12px]"
              style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--zn-danger)' }}>
              <strong>Previous review notes:</strong> {item.review_notes}
            </div>
          )}
          {canReview && item.status === 'pending' && (
            <>
              <div>
                <label className="field-label">Review notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes for the submitter..." rows={3} className="field-input resize-none" />
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => reviewMutation.mutate({ id: item.id, status: 'approved', notes })}
                  disabled={reviewMutation.isPending}
                  className="btn-gold flex items-center gap-1.5 flex-1 justify-center"
                >
                  <IconCheck size={14} /> Approve
                </button>
                <button
                  onClick={() => reviewMutation.mutate({ id: item.id, status: 'revision_requested', notes })}
                  disabled={reviewMutation.isPending}
                  className="btn-ghost flex items-center gap-1.5 flex-1 justify-center"
                  style={{ borderColor: 'var(--zn-warning)', color: 'var(--zn-warning)' }}
                >
                  <IconAlertTriangle size={14} /> Request revision
                </button>
                <button
                  onClick={() => reviewMutation.mutate({ id: item.id, status: 'rejected', notes })}
                  disabled={reviewMutation.isPending}
                  className="btn-danger flex items-center gap-1.5 flex-1 justify-center"
                >
                  <IconX size={14} /> Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MarketingPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'revision_requested'>('all')
  const [showSubmit,   setShowSubmit]   = useState(false)
  const [reviewing,    setReviewing]    = useState<any>(null)

  const { data: items = [], isLoading, refetch } = trpc.marketing.list.useQuery({ status: statusFilter })
  const { data: summary } = trpc.marketing.summary.useQuery()
  const { data: me } = trpc.me.getMe.useQuery()

  const canReview = me?.isCco || me?.role === 'owner'

  return (
    <div className="animate-fade-in">
      {showSubmit && <SubmitForm onClose={() => setShowSubmit(false)} onSubmitted={refetch} />}
      {reviewing  && <ReviewPanel item={reviewing} onClose={() => setReviewing(null)} onReviewed={refetch} />}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Pending review',   value: summary?.pending       ?? '—', accent: 'var(--zn-warning)' },
          { label: 'Approved',         value: summary?.approved      ?? '—', accent: 'var(--zn-success)' },
          { label: 'Needs revision',   value: summary?.needsRevision ?? '—', accent: 'var(--zn-gold-dark)' },
          { label: 'Rejected',         value: summary?.rejected      ?? '—', accent: 'var(--zn-danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-num" style={{ color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['all','pending','approved','revision_requested','rejected'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[12px] font-medium capitalize transition-all',
                statusFilter === f
                  ? 'border-[var(--zn-gold)] bg-[var(--zn-gold-bg)] text-[var(--zn-gold-dark)]'
                  : 'border-zn-border bg-white text-zn-text-2 hover:border-zn-border-2',
              )}>
              {f === 'revision_requested' ? 'Needs revision' : f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowSubmit(true)} className="btn-gold btn-sm flex items-center gap-1.5">
          <IconPlus size={13} /> Submit content
        </button>
      </div>

      {/* List */}
      <div className="card">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0">
              <div className="h-3 w-48 rounded bg-zn-surface-3 animate-pulse" />
              <div className="h-5 w-24 rounded-full bg-zn-surface-3 animate-pulse ml-auto" />
            </div>
          ))
        ) : (items as any[]).length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-zn-text-3">
            No marketing content submissions yet.
          </div>
        ) : (
          (items as any[]).map((item: any) => {
            const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
            return (
              <div key={item.id}
                className="flex items-center gap-4 border-b border-zn-border px-5 py-4 last:border-0 hover:bg-zn-surface-2 transition-colors cursor-pointer"
                onClick={() => setReviewing(item)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zn-text-1 truncate">{item.title}</div>
                  <div className="mt-0.5 text-[11px] text-zn-text-3">
                    {item.submitted_by_name} · {formatDate(item.created_at)} · {item.content_type?.replace(/_/g, ' ')}
                    {item.scheduled_for && ` · Scheduled ${formatDate(item.scheduled_for)}`}
                  </div>
                </div>
                <span className={cn('pill', status.pill)}>{status.label}</span>
                {canReview && item.status === 'pending' && (
                  <span className="pill-warn pill text-[10px]">Needs your review</span>
                )}
                <IconEye size={14} className="text-zn-text-3 flex-shrink-0" />
              </div>
            )
          })
        )}
      </div>

      {/* Rule reference */}
      <div className="mt-4 rounded-lg border border-zn-border bg-zn-surface-2 p-4 text-[12px] text-zn-text-3">
        <strong className="text-zn-text-2">SEC Rule 206(4)-1 (Marketing Rule):</strong> All advertisements and marketing materials must be reviewed and approved by a qualified person before dissemination. This includes social media posts, newsletters, website content, and any communication that promotes the adviser's services.
      </div>
    </div>
  )
}
