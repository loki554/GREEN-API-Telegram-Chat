import { useState, type FormEvent } from 'react'
import { GreenApiClient, defaultApiUrl } from '../api/greenApi'
import type { Credentials } from '../api/types'

interface LoginScreenProps {
  onLogin: (credentials: Credentials) => void
}

const STATE_ERRORS: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован: привяжите аккаунт в личном кабинете GREEN-API',
  blocked: 'Инстанс заблокирован',
  starting: 'Инстанс запускается, попробуйте через пару минут',
  yellowCard: 'Отправка сообщений с инстанса временно ограничена',
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiUrlEdited, setApiUrlEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const effectiveApiUrl = apiUrlEdited ? apiUrl : idInstance.trim() ? defaultApiUrl(idInstance) : ''

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const credentials: Credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: effectiveApiUrl.trim(),
    }
    if (!/^\d+$/.test(credentials.idInstance)) return setError('idInstance должен состоять из цифр')
    if (!credentials.apiTokenInstance) return setError('Укажите apiTokenInstance')
    if (!/^https?:\/\/\S+$/.test(credentials.apiUrl)) return setError('Укажите корректный apiUrl')

    setError(null)
    setLoading(true)
    try {
      const { stateInstance } = await new GreenApiClient(credentials).getStateInstance()
      if (stateInstance !== 'authorized') {
        setError(STATE_ERRORS[stateInstance] ?? `Инстанс в состоянии «${stateInstance}»`)
        return
      }
      onLogin(credentials)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="login__form" onSubmit={handleSubmit} noValidate>
        <h1>Вход через GREEN-API</h1>
        <p className="muted">
          Введите данные инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета
          </a>
        </p>

        <label className="field">
          <span>idInstance</span>
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            inputMode="numeric"
            autoComplete="username"
            placeholder="1101000001"
            autoFocus
          />
        </label>

        <label className="field">
          <span>apiTokenInstance</span>
          <input
            type="password"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            autoComplete="current-password"
            placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
          />
        </label>

        <div className="field">
          <label htmlFor="apiUrl">
            apiUrl
          </label>
          <input
            id="apiUrl"
            value={effectiveApiUrl}
            onChange={(e) => {
              setApiUrlEdited(true)
              setApiUrl(e.target.value)
            }}
            inputMode="url"
            placeholder="https://api.green-api.com"
          />
          <span className="muted">Подставляется автоматически по idInstance</span>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
