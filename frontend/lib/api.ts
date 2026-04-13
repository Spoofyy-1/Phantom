import type { Archetype, LiveEvent, PersonaRef, TestResults } from '@/types'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function fetchArchetypes(): Promise<Archetype[]> {
  const res = await fetch(`${API}/api/archetypes`)
  if (!res.ok) throw new Error('Failed to fetch archetypes')
  const data = await res.json()
  return data.archetypes
}

export async function expandPersona(description: string): Promise<Archetype & { system_prompt: string }> {
  const res = await fetch(`${API}/api/expand-persona`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to expand persona')
  }
  const data = await res.json()
  return data.persona
}

export async function startTest(
  url: string,
  task: string,
  personas: PersonaRef[]
): Promise<string> {
  const res = await fetch(`${API}/api/run-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, task, personas }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to start test')
  }
  const data = await res.json()
  return data.test_id
}

export function subscribeToTest(
  testId: string,
  onEvent: (event: LiveEvent) => void,
  onError: (err: Error) => void
): () => void {
  const url = `${API}/api/test/${testId}/stream`
  const es = new EventSource(url)

  es.onmessage = (e) => {
    if (!e.data || e.data.trim() === '{}') return
    try {
      const event: LiveEvent = JSON.parse(e.data)
      onEvent(event)
      if (event.type === 'test_complete' || event.type === 'error') {
        es.close()
      }
    } catch {
      // ignore parse errors from keep-alive pings
    }
  }

  es.onerror = () => {
    es.close()
    onError(new Error('Stream connection lost'))
  }

  return () => es.close()
}

export async function getTestResults(testId: string): Promise<{
  status: string
  results: TestResults | null
}> {
  const res = await fetch(`${API}/api/test/${testId}/results`)
  if (!res.ok) throw new Error('Failed to fetch results')
  return res.json()
}
