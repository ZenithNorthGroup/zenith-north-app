'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'
import {
  IconGripVertical, IconTrash, IconPlus,
  IconCheck, IconChevronRight, IconSettings,
  IconBolt,
} from '@tabler/icons-react'

// ── Step types available in the palette ───────────────────

const PALETTE_SKILLS = [
  {
    group: 'CRM',
    steps: [
      { slug: 'collect-info',      name: 'Collect client information', skillSlug: 'crm' },
      { slug: 'internal-approval', name: 'Internal approval',          skillSlug: 'crm' },
      { slug: 'household-review',  name: 'Household review',           skillSlug: 'crm' },
    ],
  },
  {
    group: 'Compliance',
    steps: [
      { slug: 'kyc-verification',  name: 'KYC verification',           skillSlug: 'compliance' },
      { slug: 'risk-profile',      name: 'Risk profile assessment',    skillSlug: 'compliance' },
      { slug: 'suitability-review',name: 'Suitability review',         skillSlug: 'compliance' },
      { slug: 'deliver-adv',       name: 'Deliver ADV Part 2',         skillSlug: 'compliance' },
    ],
  },
  {
    group: 'Documents',
    steps: [
      { slug: 'get-signature',     name: 'Get signature',              skillSlug: 'documents' },
      { slug: 'request-upload',    name: 'Request document upload',    skillSlug: 'documents' },
    ],
  },
  {
    group: 'AI',
    steps: [
      { slug: 'meeting-summary',   name: 'AI meeting summary',         skillSlug: 'ai' },
    ],
  },
]

// ── Step config inspector ──────────────────────────────────

function Inspector({ step, onChange }: {
  step: any | null
  onChange: (updates: Partial<any>) => void
}) {
  if (!step) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <IconSettings size={22} className="mb-3 text-zn-text-3" />
        <div className="font-mono text-[11px] text-zn-text-3">
          SELECT A STEP TO CONFIGURE
        </div>
      </div>
    )
  }

  const config = step.config ?? {}

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-zn-text-3 mb-3">
        Step settings
      </div>

      <div className="field">
        <label className="field-label">Step name</label>
        <input
          className="field-input"
          value={step.name}
          onChange={e => onChange({ name: e.target.value })}
        />
      </div>

      <div className="field">
        <label className="field-label">Assigned to</label>
        <select
          className="field-select"
          value={config.portal ? 'client' : config.approver_role ?? 'advisor'}
          onChange={e => {
            const val = e.target.value
            onChange({
              config: {
                ...config,
                portal:        val === 'client',
                approver_role: val === 'advisor' || val === 'client' ? undefined : val,
              }
            })
          }}
        >
          <option value="advisor">Advisor</option>
          <option value="client">Client (portal)</option>
          <option value="admin">Admin</option>
          <option value="cco">CCO</option>
        </select>
      </div>

      <div className="field">
        <label className="field-label">Deadline</label>
        <select
          className="field-select"
          value={config.deadline_days ?? ''}
          onChange={e => onChange({
            config: { ...config, deadline_days: e.target.value ? Number(e.target.value) : undefined }
          })}
        >
          <option value="">No deadline</option>
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
        </select>
      </div>

      <div className="field">
        <label className="field-label">Reminders</label>
        <select
          className="field-select"
          value={config.notification?.reminder_days?.join(',') ?? ''}
          onChange={e => onChange({
            config: {
              ...config,
              notification: {
                ...config.notification,
                reminder_days: e.target.value
                  ? e.target.value.split(',').map(Number)
                  : undefined,
              }
            }
          })}
        >
          <option value="">None</option>
          <option value="3,7">3 days, 7 days</option>
          <option value="7,14">7 days, 14 days</option>
          <option value="1,3,7">1, 3, 7 days</option>
        </select>
      </div>

      <div className="space-y-2 pt-1">
        {[
          { key: 'required',              label: 'Required step' },
          { key: 'requires_signature',    label: 'Requires signature' },
          { key: 'requires_acknowledgment', label: 'Requires acknowledgment' },
        ].map(toggle => (
          <div key={toggle.key} className="flex items-center justify-between">
            <span className="text-sm text-zn-text-2">{toggle.label}</span>
            <button
              onClick={() => {
                if (toggle.key === 'required') {
                  onChange({ required: !step.required })
                } else {
                  onChange({
                    config: { ...config, [toggle.key]: !config[toggle.key] }
                  })
                }
              }}
              className={cn(
                'relative h-4 w-7 rounded-full border transition-all',
                (toggle.key === 'required' ? step.required : config[toggle.key])
                  ? 'border-zn-gold bg-zn-gold'
                  : 'border-zn-border-2 bg-zn-surface-3',
              )}
            >
              <div className={cn(
                'absolute top-[1px] h-3 w-3 rounded-full bg-white transition-transform',
                (toggle.key === 'required' ? step.required : config[toggle.key])
                  ? 'left-[13px]'
                  : 'left-[1px]',
              )} />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <label className="field-label">Condition (optional)</label>
        <div
          className="cursor-pointer rounded border border-dashed border-zn-border px-3 py-2 font-mono text-[11px] text-zn-text-3 hover:border-zn-gold/30 hover:text-zn-text-2 transition-colors"
        >
          + Add condition — only run if...
        </div>
      </div>
    </div>
  )
}

// ── Step node ──────────────────────────────────────────────

function StepNode({ step, index, total, selected, onSelect, onRemove }: {
  step: any
  index: number
  total: number
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const config = step.config ?? {}
  const isConditional = !!config.conditions?.length

  return (
    <div className="flex items-stretch gap-0">
      {/* Connector */}
      <div className="flex w-9 flex-shrink-0 flex-col items-center">
        <div className="w-px flex-1 bg-zn-border" style={{ minHeight: 10 }} />
        <div className={cn(
          'h-2 w-2 rounded-full border',
          selected ? 'border-zn-gold bg-zn-gold' : 'border-zn-border-2 bg-zn-surface-3',
        )} />
        <div className="w-px flex-1 bg-zn-border" style={{ minHeight: 10 }} />
      </div>

      {/* Card */}
      <div
        onClick={onSelect}
        className={cn(
          'group my-1 flex flex-1 cursor-pointer items-center gap-2.5 rounded border px-3 py-2.5 transition-all',
          selected
            ? 'border-zn-gold/40 bg-zn-gold/8'
            : 'border-zn-border bg-zn-surface hover:border-zn-border-2',
          isConditional && 'border-dashed',
        )}
      >
        {/* Step number */}
        <div className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded font-mono text-[9px] font-semibold',
          selected ? 'bg-zn-gold/20 text-zn-gold' : 'bg-zn-surface-3 text-zn-text-3',
        )}>
          {index + 1}
        </div>

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zn-text-1 truncate">{step.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {/* Tags */}
            {step.required && (
              <span className="pill pill-ghost text-[9px]">Required</span>
            )}
            {config.portal && (
              <span className="pill pill-gold text-[9px]">Client portal</span>
            )}
            {config.requires_signature && (
              <span className="pill pill-success text-[9px]">Signature</span>
            )}
            {isConditional && (
              <span className="pill pill-warn text-[9px]">Conditional</span>
            )}
            {config.approver_role && (
              <span className="pill pill-ghost text-[9px]">{config.approver_role}</span>
            )}
          </div>
        </div>

        {/* Actions — show on hover */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="cursor-grab rounded border border-zn-border p-1 text-zn-text-3 hover:text-zn-text-1">
            <IconGripVertical size={12} />
          </div>
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="rounded border border-zn-border p-1 text-zn-text-3 transition-colors hover:border-zn-danger/30 hover:text-zn-danger"
          >
            <IconTrash size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function BuilderPage() {
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [localSteps, setLocalSteps] = useState<any[]>([])
  const [saved, setSaved] = useState(false)

  const { data: workflows = [], isLoading } = trpc.workflows.listDefinitions.useQuery()
  const updateStepMutation = trpc.workflows.updateStep.useMutation()

  // Load steps when workflow selected
  function selectWorkflow(workflow: any) {
    setActiveWorkflowId(workflow.id)
    setLocalSteps(workflow.steps ?? [])
    setSelectedStepIdx(null)
    setSaved(false)
  }

  function addStep(template: any) {
    const newStep = {
      id:        crypto.randomUUID(),
      workflowId: activeWorkflowId,
      slug:      template.slug,
      name:      template.name,
      skillSlug: template.skillSlug,
      sortOrder: localSteps.length + 1,
      required:  true,
      config:    {},
      _isNew:    true,
    }
    setLocalSteps(prev => [...prev, newStep])
    setSelectedStepIdx(localSteps.length)
    setSaved(false)
  }

  function removeStep(index: number) {
    setLocalSteps(prev => prev.filter((_, i) => i !== index))
    setSelectedStepIdx(null)
    setSaved(false)
  }

  function updateSelected(updates: Partial<any>) {
    if (selectedStepIdx === null) return
    setLocalSteps(prev => prev.map((s, i) =>
      i === selectedStepIdx ? { ...s, ...updates } : s
    ))
    setSaved(false)
  }

  async function handleSave() {
    // Save each modified step
    for (const step of localSteps) {
      if (!step._isNew) {
        await updateStepMutation.mutateAsync({
          stepId:    step.id,
          name:      step.name,
          required:  step.required,
          sortOrder: step.sortOrder,
          config:    step.config,
        })
      }
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const selectedStep = selectedStepIdx !== null ? localSteps[selectedStepIdx] : null
  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-zn-text-1">
            Workflow builder
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-zn-text-3">
            CONFIGURE YOUR FIRM'S PROCESSES · CHANGES ARE LIVE IMMEDIATELY
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeWorkflowId && (
            <>
              <button className="btn-ghost btn-sm">Duplicate</button>
              <button className="btn-ghost btn-sm">Test run</button>
              <button
                onClick={handleSave}
                className={cn(
                  'btn-sm',
                  saved ? 'btn-ghost text-zn-success' : 'btn-gold',
                )}
              >
                {saved ? (
                  <><IconCheck size={12} /> Saved</>
                ) : (
                  updateStepMutation.isPending ? 'Saving...' : 'Publish changes'
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Workflow selector */}
      {!isLoading && workflows.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-mono text-[11px] text-zn-text-3">WORKFLOW:</span>
          {workflows.map(w => (
            <button
              key={w.id}
              onClick={() => selectWorkflow(w)}
              className={cn(
                'rounded border px-3 py-1.5 text-sm transition-all',
                activeWorkflowId === w.id
                  ? 'border-zn-gold/30 bg-zn-gold/10 font-medium text-zn-gold'
                  : 'border-zn-border text-zn-text-2 hover:border-zn-border-2',
              )}
            >
              {w.name}
            </button>
          ))}
          <button className="btn-ghost btn-sm flex items-center gap-1">
            <IconPlus size={12} /> New workflow
          </button>
        </div>
      )}

      {/* Main builder — 3 columns */}
      <div className="flex h-[560px] overflow-hidden rounded-md border border-zn-border">

        {/* Palette */}
        <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-zn-border bg-zn-surface p-2">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-zn-text-3 px-2 pt-1">
            Step library
          </div>
          {PALETTE_SKILLS.map(group => (
            <div key={group.group} className="mb-4">
              <div className="mb-1.5 px-2 font-mono text-[9px] uppercase tracking-wider text-zn-text-3">
                {group.group}
              </div>
              {group.steps.map(step => (
                <div
                  key={step.slug}
                  onClick={() => activeWorkflowId && addStep(step)}
                  className={cn(
                    'mb-1 flex cursor-pointer items-center gap-2 rounded border border-zn-border bg-zn-surface-2 px-2.5 py-2 text-[12px] text-zn-text-2 transition-all',
                    activeWorkflowId
                      ? 'hover:border-zn-gold/30 hover:text-zn-text-1'
                      : 'cursor-not-allowed opacity-40',
                  )}
                  title={activeWorkflowId ? 'Click to add' : 'Select a workflow first'}
                >
                  <IconPlus size={10} className="flex-shrink-0 text-zn-text-3" />
                  {step.name}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Canvas toolbar */}
          <div className="flex items-center justify-between border-b border-zn-border bg-zn-surface-2 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-zn-text-1">
                {activeWorkflow?.name ?? 'Select a workflow'}
              </span>
              {activeWorkflow && (
                <div className="flex items-center gap-1.5 rounded border border-zn-gold/20 bg-zn-gold/8 px-2 py-0.5">
                  <IconBolt size={10} className="text-zn-gold" />
                  <span className="font-mono text-[10px] text-zn-gold">
                    {activeWorkflow.trigger}
                  </span>
                </div>
              )}
            </div>
            {activeWorkflowId && (
              <span className="font-mono text-[10px] text-zn-text-3">
                {localSteps.length} STEPS
              </span>
            )}
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {!activeWorkflowId ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="font-mono text-[11px] text-zn-text-3">
                  SELECT A WORKFLOW TO START EDITING
                </div>
                {isLoading && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zn-border border-t-zn-gold" />
                )}
              </div>
            ) : localSteps.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="font-mono text-[11px] text-zn-text-3">
                  NO STEPS YET · ADD FROM THE LIBRARY
                </div>
              </div>
            ) : (
              <>
                {/* Start node */}
                <div className="flex items-center gap-2 px-9 py-1">
                  <div className="h-px flex-1 bg-zn-border" />
                  <div className="rounded border border-zn-gold/20 bg-zn-gold/8 px-3 py-1 font-mono text-[10px] text-zn-gold">
                    START
                  </div>
                  <div className="h-px flex-1 bg-zn-border" />
                </div>

                {localSteps.map((step, i) => (
                  <StepNode
                    key={step.id}
                    step={step}
                    index={i}
                    total={localSteps.length}
                    selected={selectedStepIdx === i}
                    onSelect={() => setSelectedStepIdx(i)}
                    onRemove={() => removeStep(i)}
                  />
                ))}

                {/* Add step */}
                <div className="flex items-stretch gap-0">
                  <div className="flex w-9 flex-shrink-0 flex-col items-center">
                    <div className="w-px flex-1 bg-zn-border" />
                  </div>
                  <div
                    className="my-1 flex flex-1 cursor-pointer items-center gap-2 rounded border border-dashed border-zn-border px-3 py-2 text-[12px] text-zn-text-3 transition-all hover:border-zn-gold/30 hover:text-zn-gold"
                  >
                    <IconPlus size={12} />
                    Add step from library
                  </div>
                </div>

                {/* End node */}
                <div className="flex items-center gap-2 px-9 py-1">
                  <div className="h-px flex-1 bg-zn-border" />
                  <div className="rounded border border-zn-success/20 bg-zn-success/8 px-3 py-1 font-mono text-[10px] text-zn-success">
                    COMPLETE
                  </div>
                  <div className="h-px flex-1 bg-zn-border" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Inspector */}
        <div className="w-52 flex-shrink-0 overflow-hidden border-l border-zn-border bg-zn-surface">
          <div className="border-b border-zn-border px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-zn-text-3">
              {selectedStep ? selectedStep.name : 'Step settings'}
            </div>
          </div>
          <Inspector step={selectedStep} onChange={updateSelected} />
        </div>
      </div>
    </div>
  )
}
