import { useEffect, useState } from 'react'
import type { GreenApiClient } from '../api/greenApi'
import type { InstanceSettings } from '../api/types'

export const REQUIRED_SETTINGS = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
} as const satisfies Partial<InstanceSettings>

export function missingSettings(settings: InstanceSettings): string[] {
  return Object.entries(REQUIRED_SETTINGS)
    .filter(([key, value]) => (settings[key] ?? '') !== value)
    .map(([key]) => key)
}

type BannerState =
  | { kind: 'hidden' }
  | { kind: 'needsSetup'; missing: string[] }
  | { kind: 'saving'; missing: string[] }
  | { kind: 'saved' }
  | { kind: 'error'; missing: string[]; message: string }

export function SettingsBanner({ client }: { client: GreenApiClient }) {
  const [state, setState] = useState<BannerState>({ kind: 'hidden' })

  useEffect(() => {
    const controller = new AbortController()
    client
      .getSettings(controller.signal)
      .then((settings) => {
        const missing = missingSettings(settings)
        if (missing.length > 0) setState({ kind: 'needsSetup', missing })
      })
      .catch(() => {
        // Не критично: если настройки прочитать не удалось, чат всё равно работает
      })
    return () => controller.abort()
  }, [client])

  if (state.kind === 'hidden') return null

  async function apply(missing: string[]) {
    setState({ kind: 'saving', missing })
    try {
      await client.setSettings(REQUIRED_SETTINGS)
      setState({ kind: 'saved' })
    } catch (e) {
      setState({ kind: 'error', missing, message: e instanceof Error ? e.message : String(e) })
    }
  }

  const dismiss = (
    <button type="button" className="link" onClick={() => setState({ kind: 'hidden' })}>
      Скрыть
    </button>
  )

  if (state.kind === 'saved') {
    return (
      <div className="banner" role="status">
        <span>Настройки инстанса сохранены. Новые сообщения будут появляться в чате.</span>
        {dismiss}
      </div>
    )
  }

  const willClearWebhook = state.missing.includes('webhookUrl')
  return (
    <div className="banner" role="status">
      <span>
        Чтобы видеть ответы и статусы сообщений, включите уведомления в настройках инстанса
        {willClearWebhook && ' (webhookUrl будет очищен: уведомления пойдут в очередь HTTP API)'}.
        {state.kind === 'error' && <span className="error"> {state.message}</span>}
      </span>
      <button
        type="button"
        disabled={state.kind === 'saving'}
        onClick={() => apply(state.missing)}
      >
        {state.kind === 'saving' ? 'Сохраняем…' : 'Включить'}
      </button>
      {dismiss}
    </div>
  )
}
