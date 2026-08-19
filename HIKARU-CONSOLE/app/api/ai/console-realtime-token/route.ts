import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// ============================================================
// POST /api/ai/console-realtime-token — CONSOLE Realtime Ephemeral Token
// System token endpoint とは完全分離。CONSOLE Admin認証のみ。
// ============================================================

export const maxDuration = 15

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  let body: { model?: string; voice?: string } = {}
  try { body = await req.json() } catch {}

  const model = body.model ?? 'gpt-realtime-2.1'
  const voice = body.voice ?? 'alloy'

  try {
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, voice }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[console-realtime-token]', err)
      return Response.json({ error: 'Failed to create realtime session' }, { status: 502 })
    }

    const session = await res.json()
    return Response.json({
      clientSecret: session?.client_secret?.value ?? null,
      sessionId:    session?.id ?? null,
      model,
      voice,
    })
  } catch (err) {
    console.error('[console-realtime-token]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
