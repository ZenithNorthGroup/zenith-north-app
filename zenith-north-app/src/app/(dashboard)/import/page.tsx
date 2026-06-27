'use client'

import { useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import {
  IconUpload, IconCheck, IconX,
  IconAlertTriangle, IconFileText,
  IconArrowRight, IconSparkles,
} from '@tabler/icons-react'

// ── Steps ─────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'importing' | 'done'

// ── Drop zone ──────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (content: string, name: string) => void }) {
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      onFile(content, file.name)
    }
    reader.readAsText(file)
  }, [onFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-8 py-14 text-center transition-all',
        dragging
          ? 'border-zn-gold bg-zn-gold/8'
          : 'border-zn-border hover:border-zn-border-2',
      )}
    >
      <IconUpload size={28} className={cn('mb-3', dragging ? 'text-zn-gold' : 'text-zn-text-3')} />
      <div className="mb-1 text-sm font-medium text-zn-text-1">
        Drop your Redtail CSV export here
      </div>
      <div className="mb-4 font-mono text-[11px] text-zn-text-3">
        Or click to browse
      </div>
      <label className="btn-gold btn-sm cursor-pointer">
        Choose CSV file
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </label>
      <div className="mt-6 max-w-sm font-mono text-[10px] text-zn-text-3">
        In Redtail: Contacts → Export → CSV. All client records will be imported.
        KYC status will be set to "needs review" for your verification after import.
      </div>
    </div>
  )
}

// ── Preview table ──────────────────────────────────────────

function PreviewTable({ records }: { records: any[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <span className="card-title">Preview — first 10 records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zn-border bg-zn-surface-2">
              {['Row', 'Name', 'Email', 'Status', 'Valid'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-zn-text-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r: any) => (
              <tr key={r.row} className="border-b border-zn-border last:border-0 hover:bg-zn-surface-2">
                <td className="px-4 py-2.5 font-mono text-[11px] text-zn-text-3">{r.row}</td>
                <td className="px-4 py-2.5 text-sm text-zn-text-1">{r.name || '—'}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-zn-text-3">{r.email || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('pill', r.status === 'active' ? 'pill-success' : 'pill-ghost')}>
                    {r.status ?? 'prospect'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {r.valid
                    ? <IconCheck size={14} className="text-zn-success" />
                    : (
                      <div className="flex items-center gap-1.5">
                        <IconX size={14} className="text-zn-danger" />
                        <span className="font-mono text-[10px] text-zn-danger">{r.errors?.[0]}</span>
                      </div>
                    )
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [previewData, setPreviewData] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [skipInvalid, setSkipInvalid] = useState(true)

  const previewMutation = trpc.import.previewRedtail.useMutation({
    onSuccess: data => {
      setPreviewData(data)
      setStep('preview')
    },
  })

  const importMutation = trpc.import.importRedtail.useMutation({
    onSuccess: data => {
      setImportResult(data)
      setStep('done')
    },
  })

  function handleFile(content: string, name: string) {
    setCsvContent(content)
    setFileName(name)
    previewMutation.mutate({ csvContent: content })
  }

  function handleImport() {
    setStep('importing')
    importMutation.mutate({ csvContent, skipInvalid })
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
          Import from Redtail
        </h1>
        <p className="mt-1 font-mono text-[11px] text-zn-text-3">
          MIGRATE YOUR EXISTING CLIENT DATA · TAKES UNDER 5 MINUTES
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-6 flex items-center gap-2">
        {[
          { key: 'upload',    label: 'Upload' },
          { key: 'preview',   label: 'Preview' },
          { key: 'importing', label: 'Import' },
          { key: 'done',      label: 'Complete' },
        ].map((s, i, arr) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-medium',
              step === s.key
                ? 'bg-zn-gold text-zn-black'
                : ['done', 'preview', 'importing'].includes(step) && i < arr.findIndex(x => x.key === step)
                ? 'bg-zn-success/20 text-zn-success'
                : 'bg-zn-surface-3 text-zn-text-3',
            )}>
              {['done', 'preview', 'importing'].includes(step) && i < arr.findIndex(x => x.key === step)
                ? <IconCheck size={11} />
                : i + 1
              }
            </div>
            <span className={cn(
              'text-sm',
              step === s.key ? 'font-medium text-zn-text-1' : 'text-zn-text-3',
            )}>
              {s.label}
            </span>
            {i < arr.length - 1 && (
              <IconArrowRight size={14} className="text-zn-text-3" />
            )}
          </div>
        ))}
      </div>

      {/* Upload step */}
      {step === 'upload' && (
        <div>
          {previewMutation.isPending ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-zn-border py-16">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zn-border border-t-zn-gold" />
              <div className="font-mono text-[11px] text-zn-text-3">PARSING CSV...</div>
            </div>
          ) : (
            <DropZone onFile={handleFile} />
          )}

          {previewMutation.isError && (
            <div className="mt-3 rounded border border-zn-danger/30 bg-zn-danger/8 px-4 py-3 font-mono text-[11px] text-zn-danger">
              Failed to parse CSV. Make sure it's a valid Redtail export.
            </div>
          )}

          {/* Also supports CSV */}
          <div className="mt-4 rounded border border-zn-border bg-zn-surface-2 px-4 py-3">
            <div className="mb-2 font-mono text-[11px] font-medium text-zn-text-2">
              Other sources
            </div>
            <div className="flex gap-3">
              {['Wealthbox', 'Salesforce', 'Generic CSV'].map(source => (
                <button
                  key={source}
                  className="btn-ghost btn-sm opacity-60 cursor-not-allowed"
                  title="Coming soon"
                >
                  {source}
                </button>
              ))}
            </div>
            <div className="mt-2 font-mono text-[10px] text-zn-text-3">
              Wealthbox and Salesforce importers coming in Phase 3
            </div>
          </div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && previewData && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <div className="stat-label">Total records</div>
              <div className="stat-num text-zn-gold">{previewData.total}</div>
              <div className="stat-delta">In {fileName}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Valid</div>
              <div className="stat-num text-zn-success">{previewData.valid}</div>
              <div className="stat-delta">Ready to import</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Issues</div>
              <div className={cn('stat-num', previewData.invalid > 0 ? 'text-zn-warning' : 'text-zn-text-1')}>
                {previewData.invalid}
              </div>
              <div className="stat-delta">
                {previewData.invalid > 0 ? 'Will be skipped' : 'None'}
              </div>
            </div>
          </div>

          {/* Error details */}
          {previewData.errors?.length > 0 && (
            <div className="rounded border border-zn-warning/30 bg-zn-warning/8 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 font-mono text-[11px] font-medium text-zn-warning">
                <IconAlertTriangle size={13} />
                {previewData.invalid} records have issues and will be skipped
              </div>
              <div className="space-y-1">
                {previewData.errors.slice(0, 5).map((e: any) => (
                  <div key={e.row} className="font-mono text-[10px] text-zn-text-2">
                    Row {e.row} · {e.name || 'Unknown'} · {e.errors?.join(', ')}
                  </div>
                ))}
                {previewData.errors.length > 5 && (
                  <div className="font-mono text-[10px] text-zn-text-3">
                    +{previewData.errors.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview table */}
          {previewData.preview && <PreviewTable records={previewData.preview} />}

          {/* Options */}
          <div className="flex items-center gap-3 rounded border border-zn-border bg-zn-surface-2 px-4 py-3">
            <button
              onClick={() => setSkipInvalid(!skipInvalid)}
              className={cn(
                'h-4 w-4 rounded border transition-all',
                skipInvalid ? 'border-zn-gold bg-zn-gold' : 'border-zn-border-2 bg-zn-surface-3',
              )}
            >
              {skipInvalid && <IconCheck size={10} className="text-zn-black" />}
            </button>
            <span className="text-sm text-zn-text-2">
              Skip invalid records and import valid ones
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={previewData.valid === 0}
              className={cn(
                'btn-gold',
                previewData.valid === 0 && 'cursor-not-allowed opacity-50',
              )}
            >
              <IconSparkles size={14} />
              Import {previewData.valid} clients
            </button>
            <button
              onClick={() => { setStep('upload'); setPreviewData(null) }}
              className="btn-ghost"
            >
              Choose different file
            </button>
          </div>
        </div>
      )}

      {/* Importing step */}
      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zn-border py-20">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zn-border border-t-zn-gold" />
          <div className="mb-2 text-sm font-medium text-zn-text-1">
            Importing your clients...
          </div>
          <div className="font-mono text-[11px] text-zn-text-3">
            This usually takes under 60 seconds
          </div>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && importResult && (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-lg border border-zn-gold/30 bg-zn-gold/6 px-8 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zn-gold/30 bg-zn-gold/10">
              <IconCheck size={22} className="text-zn-gold" />
            </div>
            <div className="mb-1 text-lg font-semibold text-zn-text-1">
              Migration complete
            </div>
            <div className="font-mono text-[11px] text-zn-text-3">
              {importResult.imported} clients imported from Redtail
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card">
              <div className="stat-label">Imported</div>
              <div className="stat-num text-zn-success">{importResult.imported}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Skipped</div>
              <div className="stat-num">{importResult.skipped}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Errors</div>
              <div className="stat-num text-zn-warning">{importResult.errors?.length ?? 0}</div>
            </div>
          </div>

          <div className="rounded border border-zn-warning/30 bg-zn-warning/8 px-4 py-3">
            <div className="mb-1 font-mono text-[11px] font-medium text-zn-warning">
              Next step — KYC verification
            </div>
            <div className="font-mono text-[10px] text-zn-text-2">
              All imported clients have KYC status set to "needs review".
              Verify each client's identity before marking as active.
              The compliance dashboard will surface these as action items.
            </div>
          </div>

          <div className="flex gap-3">
            <a href="/clients" className="btn-gold">
              View imported clients
            </a>
            <a href="/compliance" className="btn-ghost">
              View compliance items
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
