import type {
  Credentials,
  InstanceSettings,
  ReceivedNotification,
  SendMessageResponse,
  StateInstanceResponse,
} from './types'

export class GreenApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
  }
}

/** Хост API определяется первыми 4 цифрами idInstance: 4100… → https://4100.api.green-api.com */
export function defaultApiUrl(idInstance: string): string {
  const prefix = idInstance.trim().slice(0, 4)
  return /^\d{4}$/.test(prefix) ? `https://${prefix}.api.green-api.com` : 'https://api.green-api.com'
}

function describeHttpError(status: number, bodyText: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Неверный idInstance или apiTokenInstance'
    case 429:
      return 'Слишком много запросов, попробуйте позже'
    case 466:
      return 'Превышен лимит тарифа GREEN-API'
    default: {
      let details = bodyText.trim()
      try {
        const parsed = JSON.parse(details) as { message?: string }
        if (parsed.message) details = parsed.message
      } catch {
      }
      return `Ошибка GREEN-API (${status})${details ? `: ${details.slice(0, 200)}` : ''}`
    }
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  pathSuffix?: string
  query?: Record<string, string | number>
  signal?: AbortSignal
}

export class GreenApiClient {
  private readonly credentials: Credentials

  constructor(credentials: Credentials) {
    this.credentials = credentials
  }

  buildUrl(apiMethod: string, pathSuffix = '', query?: Record<string, string | number>): string {
    const { apiUrl, idInstance, apiTokenInstance } = this.credentials
    const base = apiUrl.trim().replace(/\/+$/, '')
    const url = `${base}/waInstance${idInstance}/${apiMethod}/${apiTokenInstance}${pathSuffix}`
    if (!query) return url
    const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))
    return `${url}?${params}`
  }

  private async request<T>(apiMethod: string, options: RequestOptions = {}): Promise<T | null> {
    const { method = 'GET', body, pathSuffix, query, signal } = options
    let response: Response
    try {
      response = await fetch(this.buildUrl(apiMethod, pathSuffix, query), {
        method,
        signal,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new GreenApiError('Нет соединения с GREEN-API. Проверьте интернет и apiUrl')
    }

    const text = await response.text()
    if (!response.ok) throw new GreenApiError(describeHttpError(response.status, text), response.status)
    // receiveNotification при пустой очереди отвечает пустым телом (или null)
    if (!text.trim()) return null
    try {
      return JSON.parse(text) as T | null
    } catch {
      throw new GreenApiError('Некорректный ответ GREEN-API', response.status)
    }
  }

  private async requireBody<T>(promise: Promise<T | null>): Promise<T> {
    const result = await promise
    if (result === null) throw new GreenApiError('Пустой ответ GREEN-API')
    return result
  }

  getStateInstance(signal?: AbortSignal): Promise<StateInstanceResponse> {
    return this.requireBody(this.request<StateInstanceResponse>('getStateInstance', { signal }))
  }

  getSettings(signal?: AbortSignal): Promise<InstanceSettings> {
    return this.requireBody(this.request<InstanceSettings>('getSettings', { signal }))
  }

  setSettings(settings: Partial<InstanceSettings>): Promise<{ saveSettings: boolean }> {
    return this.requireBody(this.request('setSettings', { method: 'POST', body: settings }))
  }

  sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
    return this.requireBody(
      this.request<SendMessageResponse>('sendMessage', { method: 'POST', body: { chatId, message } }),
    )
  }

  getAvatar(chatId: string, signal?: AbortSignal): Promise<{ urlAvatar: string }> {
    return this.requireBody(this.request('getAvatar', { method: 'POST', body: { chatId }, signal }))
  }

  receiveNotification(receiveTimeout: number, signal?: AbortSignal): Promise<ReceivedNotification | null> {
    return this.request<ReceivedNotification>('receiveNotification', { query: { receiveTimeout }, signal })
  }

  deleteNotification(receiptId: number, signal?: AbortSignal): Promise<{ result: boolean } | null> {
    return this.request('deleteNotification', { method: 'DELETE', pathSuffix: `/${receiptId}`, signal })
  }
}
