import { useState } from 'react'
import { buildCoachingPrompt, SYSTEM_PROMPT } from '../lib/analysis/coaching'
import type { EvalResult } from '../lib/engine/useEngine'
import type { MoveAnalysis } from '../lib/analysis/classify'

interface CoachingState {
  explanation: string | null
  isLoading: boolean
  error: string | null
}

const INITIAL: CoachingState = { explanation: null, isLoading: false, error: null }

export function useCoaching() {
  const [state, setState] = useState<CoachingState>(INITIAL)
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('anthropic-key') ?? '',
  )

  const saveApiKey = (key: string) => {
    setApiKey(key)
    localStorage.setItem('anthropic-key', key)
  }

  const explainMove = async (params: {
    fenBefore: string
    sanPlayed: string
    evalBefore: EvalResult
    evalAfter: EvalResult
    analysis: MoveAnalysis
  }) => {
    if (!apiKey || params.analysis.classification === 'Book') return
    setState({ explanation: null, isLoading: true, error: null })
    const prompt = buildCoachingPrompt(params)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'API-Fehler')
      setState({ explanation: json.content[0].text, isLoading: false, error: null })
    } catch (e) {
      setState({ explanation: null, isLoading: false, error: String(e) })
    }
  }

  const reset = () => setState(INITIAL)

  return { ...state, apiKey, saveApiKey, explainMove, reset }
}
