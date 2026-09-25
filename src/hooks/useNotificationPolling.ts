import { useEffect, useRef, useState } from 'react'
import type { GreenApiClient } from '../api/greenApi'
import type { NotificationBody } from '../api/types'

export type PollingStatus = 'connecting' | 'online' | 'error'

/** Секунды, допустимо 5-60. */
export const RECEIVE_TIMEOUT_S = 20
const RETRY_DELAY_MS = 5000
/** Защита от частых запросов, если сервер вернул пустой ответ сразу. */
const MIN_EMPTY_INTERVAL_MS = 1000

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

/** HTTP API: receiveNotification → обработка → deleteNotification в цикле, при ошибке повтор через паузу. */
export function useNotificationPolling(
  client: GreenApiClient,
  onNotification: (body: NotificationBody) => void,
): { status: PollingStatus; error: string | null } {
  const [status, setStatus] = useState<PollingStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const handlerRef = useRef(onNotification)

  useEffect(() => {
    handlerRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    async function loop() {
      while (!signal.aborted) {
        const startedAt = Date.now()
        try {
          const notification = await client.receiveNotification(RECEIVE_TIMEOUT_S, signal)
          if (signal.aborted) return
          setStatus('online')
          setError(null)

          if (!notification) {
            const elapsed = Date.now() - startedAt
            if (elapsed < MIN_EMPTY_INTERVAL_MS) await sleep(MIN_EMPTY_INTERVAL_MS - elapsed, signal)
            continue
          }

          try {
            handlerRef.current(notification.body)
          } catch (handlerError) {
            // Некорректное уведомление не должно блокировать очередь
            console.error('Не удалось обработать уведомление', handlerError)
          }
          await client.deleteNotification(notification.receiptId, signal)
        } catch (e) {
          if (signal.aborted) return
          setStatus('error')
          setError(e instanceof Error ? e.message : String(e))
          await sleep(RETRY_DELAY_MS, signal)
        }
      }
    }

    void loop()
    return () => controller.abort()
  }, [client])

  return { status, error }
}
