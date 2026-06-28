'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { formatDate, cn } from '@/lib/utils'
import {
  IconFileText, IconCheck, IconEdit, IconPlus,
  IconHistory, IconLoader2, IconShield,
} from '@tabler/icons-react'

export default function WspPage() {
  const { data: current, isLoading, refetch } = trpc.wsp.getCurrent.useQuery()
  const { data: versions = [] } = trpc.wsp.listVersions.useQuery()
  const { data: me } = trpc.me.getMe.useQuery()

  const createDraftMutation = trpc.wsp.createDraft.useMutation({ onSuccess: () => refetch() })
  const signMutation        = trpc.wsp.sign.useMutation({ onSuccess: () => refetch() })
  const updateMutation      = trpc.wsp.update.useMutation({ onSuccess: () => { refetch(); setEditing(false) } })

  const [editing,  setEditing]  = useState(false)
  const [content,  setContent]  = useState('')
  const [showHistory, setShowHistory] = useState(false)

  function startEdit() {
    setContent(current?.content ?? '')
    setEditing(true)
  }

  const canSign = me?.isCco || me?.role === 'owner'

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[12px] text-zn-text-3">
            {(versions as any[]).length} version{(versions as any[]).length !== 1 ? 's' : ''} · Last signed{' '}
            {current?.signed_at ? formatDate(current.signed_at) : 'never'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn-ghost btn-sm flex items-center gap-1.5"
          >
            <IconHistory size={13} /> Version history
          </button>
          {(!current || current.status === 'draft') && (
            <button
              onClick={() => createDraftMutation.mutate()}
              disabled={createDraftMutation.isPending}
              className="btn-ghost btn-sm flex items-center gap-1.5"
            >
              {createDraftMutation.isPending ? <IconLoader2 size={13} className="animate-spin" /> : <IconPlus size={13} />}
              Generate new draft
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-4">
        {/* Main content */}
        <div className="card">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <IconLoader2 size={24} className="animate-spin text-zn-text-3" />
            </div>
          ) : !current ? (
            <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'var(--zn-gold-bg)' }}>
                <IconFileText size={24} style={{ color: 'var(--zn-gold)' }} />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-zn-text-1 mb-2">No WSP on file</div>
                <div className="text-[13px] text-zn-text-3 max-w-sm">
                  Generate your Written Supervisory Procedures from your firm configuration. The document will auto-populate with your CCO, advisors, and approved channels.
                </div>
              </div>
              <button
                onClick={() => createDraftMutation.mutate()}
                disabled={createDraftMutation.isPending}
                className="btn-gold flex items-center gap-2"
              >
                {createDraftMutation.isPending
                  ? <><IconLoader2 size={14} className="animate-spin" /> Generating...</>
                  : <><IconPlus size={14} /> Generate WSP draft</>
                }
              </button>
            </div>
          ) : editing ? (
            <>
              <div className="card-header">
                <span className="card-title">Editing — Version {current.version}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateMutation.mutate({ id: current.id, content })}
                    disabled={updateMutation.isPending}
                    className="btn-gold btn-sm flex items-center gap-1.5"
                  >
                    {updateMutation.isPending ? <IconLoader2 size={12} className="animate-spin" /> : <IconCheck size={12} />}
                    Save draft
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full p-5 font-mono text-[13px] text-zn-text-1 leading-relaxed resize-none focus:outline-none"
                style={{ minHeight: '70vh', background: 'var(--zn-surface-2)' }}
              />
            </>
          ) : (
            <>
              <div className="card-header">
                <div>
                  <span className="card-title">Version {current.version}</span>
                  <span className={cn('ml-3 pill text-[10px]',
                    current.status === 'active' ? 'pill-success' :
                    current.status === 'draft'  ? 'pill-gold' : 'pill-ghost'
                  )}>
                    {current.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {current.status === 'draft' && (
                    <button onClick={startEdit} className="btn-ghost btn-sm flex items-center gap-1.5">
                      <IconEdit size={12} /> Edit draft
                    </button>
                  )}
                </div>
              </div>
              <div
                className="prose prose-sm max-w-none p-6 text-zn-text-1 leading-relaxed text-[13px]"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
              >
                {current.content}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Status */}
          <div className="card">
            <div className="card-header"><span className="card-title">WSP status</span></div>
            <div className="px-4 py-4 space-y-3">
              {[
                { label: 'Status',        value: current?.status ?? 'No document' },
                { label: 'Version',       value: current?.version ? `v${current.version}` : '—' },
                { label: 'Signed by',     value: current?.signed_by_name ?? '—' },
                { label: 'Signed',        value: current?.signed_at ? formatDate(current.signed_at) : '—' },
                { label: 'Effective',     value: current?.effective_at ? formatDate(current.effective_at) : '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zn-text-3">{row.label}</span>
                  <span className="text-[13px] text-zn-text-1">{row.value}</span>
                </div>
              ))}
            </div>

            {current?.status === 'draft' && canSign && (
              <div className="border-t border-zn-border px-4 pb-4 pt-3">
                <div className="mb-3 rounded-lg p-3 text-[12px] text-zn-text-2"
                  style={{ background: 'var(--zn-gold-bg)', border: '1px solid var(--zn-gold-border)' }}>
                  By signing, you certify this WSP is current, complete, and appropriate for your firm's operations.
                </div>
                <button
                  onClick={() => signMutation.mutate({ id: current.id })}
                  disabled={signMutation.isPending}
                  className="btn-gold w-full flex items-center justify-center gap-2"
                >
                  {signMutation.isPending
                    ? <><IconLoader2 size={14} className="animate-spin" /> Signing...</>
                    : <><IconShield size={14} /> Sign & activate WSP</>
                  }
                </button>
              </div>
            )}
          </div>

          {/* Version history */}
          {showHistory && (
            <div className="card">
              <div className="card-header"><span className="card-title">Version history</span></div>
              {(versions as any[]).map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 border-b border-zn-border px-4 py-3 last:border-0">
                  <div className="flex-1">
                    <div className="text-[12px] font-medium text-zn-text-1">Version {v.version}</div>
                    <div className="text-[10px] text-zn-text-3">
                      {v.signed_at ? `Signed ${formatDate(v.signed_at)} by ${v.signed_by_name}` : 'Not signed'}
                    </div>
                  </div>
                  <span className={cn('pill text-[10px]',
                    v.status === 'active'     ? 'pill-success' :
                    v.status === 'draft'      ? 'pill-gold'    : 'pill-ghost'
                  )}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* What should be in a WSP */}
          <div className="card">
            <div className="card-header"><span className="card-title">SEC requirements</span></div>
            <div className="px-4 py-3 space-y-2">
              {[
                'Supervisory structure & hierarchy',
                'Approved communication channels',
                'Client onboarding procedures',
                'Suitability review process',
                'Annual review procedures',
                'Marketing pre-approval policy',
                'Gifts & entertainment policy',
                'Outside business activities',
                'Conflicts of interest disclosure',
                'Record keeping procedures',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-[12px] text-zn-text-2">
                  <IconCheck size={11} style={{ color: current?.status === 'active' ? 'var(--zn-success)' : 'var(--zn-border-2)' }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
