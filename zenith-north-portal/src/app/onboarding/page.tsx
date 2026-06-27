'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  IconShield, IconCheck, IconAlertCircle,
  IconFileText, IconChartBar, IconSignature,
  IconLock, IconArrowRight,
} from '@tabler/icons-react'

// ── Step type renderers ────────────────────────────────────

function RiskProfileStep({ onComplete }: { onComplete: (data: any) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const questions = [
    {
      id:      'time_horizon',
      label:   'What is your investment time horizon?',
      options: ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', 'More than 10 years'],
    },
    {
      id:      'risk_tolerance',
      label:   'How would you describe your risk tolerance?',
      options: ['Very conservative', 'Conservative', 'Moderate', 'Aggressive', 'Very aggressive'],
    },
    {
      id:      'income_stability',
      label:   'How stable is your primary income?',
      options: ['Very unstable', 'Somewhat unstable', 'Stable', 'Very stable'],
    },
    {
      id:      'loss_reaction',
      label:   'If your portfolio dropped 20% in a year, what would you do?',
      options: [
        'Sell everything immediately',
        'Sell some investments',
        'Hold and wait',
        'Buy more at lower prices',
      ],
    },
    {
      id:      'investment_experience',
      label:   'How would you describe your investment experience?',
      options: ['None', 'Limited', 'Moderate', 'Extensive'],
    },
    {
      id:      'primary_goal',
      label:   'What is your primary investment goal?',
      options: [
        'Preserve capital',
        'Generate income',
        'Balanced growth',
        'Maximize growth',
      ],
    },
  ]

  const allAnswered = questions.every(q => answers[q.id])

  // Calculate risk score from answers
  function calculateScore(): number {
    const scoreMap: Record<string, number> = {
      // time_horizon
      'Less than 1 year': 1, '1–3 years': 2, '3–5 years': 3, '5–10 years': 4, 'More than 10 years': 5,
      // risk_tolerance
      'Very conservative': 1, 'Conservative': 2, 'Moderate': 3, 'Aggressive': 4, 'Very aggressive': 5,
      // income_stability
      'Very unstable': 1, 'Somewhat unstable': 2, 'Stable': 4, 'Very stable': 5,
      // loss_reaction
      'Sell everything immediately': 1, 'Sell some investments': 2, 'Hold and wait': 3, 'Buy more at lower prices': 5,
      // experience
      'None': 1, 'Limited': 2, 'Moderate': 3, 'Extensive': 5,
      // goal
      'Preserve capital': 1, 'Generate income': 2, 'Balanced growth': 3, 'Maximize growth': 5,
    }
    const total  = Object.values(answers).reduce((sum, a) => sum + (scoreMap[a] ?? 3), 0)
    const maxScore = questions.length * 5
    return Math.round((total / maxScore) * 100)
  }

  function handleSubmit() {
    const score = calculateScore()
    const profile = score < 30 ? 'Very Conservative'
      : score < 45 ? 'Conservative'
      : score < 60 ? 'Moderate'
      : score < 75 ? 'Aggressive'
      : 'Very Aggressive'

    onComplete({ answers, score, profile })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Investment Risk Profile
        </h2>
        <p className="text-sm text-gray-500">
          Please answer all questions honestly. This information helps us ensure
          your investment strategy aligns with your goals and risk tolerance.
        </p>
      </div>

      {questions.map((q, qi) => (
        <div key={q.id} className="space-y-3">
          <label className="block text-sm font-medium text-gray-800">
            {qi + 1}. {q.label}
          </label>
          <div className="space-y-2">
            {q.options.map(opt => (
              <button
                key={opt}
                onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                  answers[q.id] === opt
                    ? 'border-amber-500 bg-amber-50 text-amber-800 font-medium'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
          allAnswered
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {allAnswered ? 'Submit risk profile →' : `Answer all ${questions.length} questions to continue`}
      </button>
    </div>
  )
}

function SignDocumentStep({
  documentName,
  documentUrl,
  onComplete,
}: {
  documentName: string
  documentUrl?: string
  onComplete: (data: any) => void
}) {
  const [read, setRead] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')

  const canSign = read && agreed && signature.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {documentName}
        </h2>
        <p className="text-sm text-gray-500">
          Please read the document below, then confirm your agreement by typing
          your full legal name.
        </p>
      </div>

      {/* Document viewer */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconFileText size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{documentName}</span>
          </div>
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-600 hover:underline"
            >
              Open full document
            </a>
          )}
        </div>
        <div className="p-4 h-64 overflow-y-auto text-sm text-gray-600 leading-relaxed bg-white">
          <p className="text-gray-400 italic text-center mt-8">
            [Document content loads here from secure storage]
          </p>
          <p className="text-gray-400 italic text-center mt-2 text-xs">
            Scroll through the document before confirming
          </p>
        </div>
      </div>

      {/* Confirmations */}
      <div className="space-y-3">
        {[
          { id: 'read',   label: 'I have read and understand this document', set: setRead,   val: read   },
          { id: 'agreed', label: 'I agree to the terms and conditions',      set: setAgreed, val: agreed },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => item.set(!item.val)}
            className="flex items-center gap-3 w-full text-left"
          >
            <div className={`h-5 w-5 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
              item.val
                ? 'bg-amber-600 border-amber-600'
                : 'border-gray-300 bg-white'
            }`}>
              {item.val && <IconCheck size={12} className="text-white" />}
            </div>
            <span className="text-sm text-gray-700">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Signature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type your full legal name to sign
        </label>
        <input
          type="text"
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder="Your full legal name"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none font-medium italic"
          style={{ fontFamily: 'Georgia, serif' }}
        />
        <p className="mt-1 text-xs text-gray-400">
          By typing your name, you are electronically signing this document with
          the same legal effect as a handwritten signature.
        </p>
      </div>

      <button
        onClick={() => onComplete({ signature, signedAt: new Date().toISOString(), agreed: true })}
        disabled={!canSign}
        className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
          canSign
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <IconSignature size={16} />
        Sign document
      </button>
    </div>
  )
}

function AcknowledgeStep({
  documentName,
  onComplete,
}: {
  documentName: string
  onComplete: (data: any) => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Acknowledge Receipt — {documentName}
        </h2>
        <p className="text-sm text-gray-500">
          Your adviser is required to provide you with this document.
          Please confirm you have received and reviewed it.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <IconShield size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-800 mb-1">
              {documentName}
            </div>
            <div className="text-xs text-amber-600">
              This document contains important information about your adviser's
              services, fees, and potential conflicts of interest.
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setAcknowledged(!acknowledged)}
        className="flex items-center gap-3 w-full text-left"
      >
        <div className={`h-5 w-5 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
          acknowledged
            ? 'bg-amber-600 border-amber-600'
            : 'border-gray-300 bg-white'
        }`}>
          {acknowledged && <IconCheck size={12} className="text-white" />}
        </div>
        <span className="text-sm text-gray-700">
          I confirm I have received and reviewed the {documentName}
        </span>
      </button>

      <button
        onClick={() => onComplete({ acknowledged: true, acknowledgedAt: new Date().toISOString() })}
        disabled={!acknowledged}
        className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
          acknowledged
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        Confirm acknowledgment →
      </button>
    </div>
  )
}

// ── Main portal page ───────────────────────────────────────

function OnboardingContent() {
  const params = useSearchParams()
  const token  = params.get('token')

  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [step,      setStep]      = useState<any>(null)
  const [completed, setCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing access link. Please request a new link from your adviser.')
      setLoading(false)
      return
    }

    // Validate token via API
    fetch(`/api/portal/validate?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setStep(data)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Unable to load your onboarding step. Please try again.')
        setLoading(false)
      })
  }, [token])

  async function handleComplete(stepData: any) {
    setSubmitting(true)
    try {
      const response = await fetch('/api/portal/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, stepData }),
      })

      const result = await response.json()

      if (result.success) {
        setCompleted(true)
      } else {
        setError(result.error ?? 'Failed to submit. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-amber-600 mb-4" />
        <div className="text-sm text-gray-500">Loading your onboarding step...</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <IconAlertCircle size={24} className="text-red-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Unable to load step</h2>
        <p className="text-sm text-gray-500 max-w-sm">{error}</p>
        <p className="text-xs text-gray-400 mt-4">
          Contact your adviser to request a new link.
        </p>
      </div>
    )
  }

  // Completed state
  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <IconCheck size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Step complete</h2>
        <p className="text-sm text-gray-500 max-w-sm mb-1">
          {step?.stepName} has been completed and recorded.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Your adviser will be notified and the next step will begin shortly.
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 max-w-sm text-left">
          <div className="flex items-center gap-2 mb-1">
            <IconShield size={14} className="text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Securely recorded</span>
          </div>
          <p className="text-xs text-amber-600">
            Your response has been securely archived per SEC Rule 204-2 and linked to your client record.
          </p>
        </div>
      </div>
    )
  }

  // Step content
  return (
    <div>
      {/* Progress indicator */}
      {step?.totalSteps && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">
              Step {step.stepNumber} of {step.totalSteps}
            </span>
            <span className="text-xs text-gray-400">
              {step.completedSteps} completed
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${(step.completedSteps / step.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Render the appropriate step type */}
      {step?.stepType === 'risk_profile' && (
        <RiskProfileStep onComplete={handleComplete} />
      )}
      {step?.stepType === 'sign_agreement' && (
        <SignDocumentStep
          documentName={step.documentName ?? 'Investment Advisory Agreement'}
          documentUrl={step.documentUrl}
          onComplete={handleComplete}
        />
      )}
      {step?.stepType === 'deliver_adv' && (
        <AcknowledgeStep
          documentName="Form ADV Part 2"
          onComplete={handleComplete}
        />
      )}
      {step?.stepType === 'collect_info' && (
        <div className="text-center py-8 text-sm text-gray-500">
          Information collection form — contact your adviser to complete this step.
        </div>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center border border-amber-300 relative">
            <div className="absolute inset-[2px] border border-amber-100" />
            <span className="relative z-10 text-sm font-semibold text-amber-600 -mt-0.5">Z</span>
            <span className="absolute bottom-1 right-1 text-[8px] font-medium text-gray-400">N</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Zenith North</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
              Client Portal
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <IconLock size={12} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 font-mono">SECURE · ENCRYPTED</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-amber-600" />
            </div>
          }>
            <OnboardingContent />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <IconShield size={12} />
            <span>
              All data is encrypted and archived per SEC Rule 204-2.
              This portal is operated by your registered investment adviser.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
