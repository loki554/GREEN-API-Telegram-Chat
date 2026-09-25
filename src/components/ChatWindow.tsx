import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { chatTitle, formatMessageTime } from '../lib/format'
import { formatPhone } from '../lib/phone'
import type { Chat, Message, MessageStatus } from '../state/types'
import { Avatar } from './Avatar'

export const MAX_MESSAGE_LENGTH = 4096

const STATUS_VIEW: Record<MessageStatus, { text: string; title: string }> = {
  pending: { text: 'отправляется…', title: 'Отправляется' },
  sent: { text: '✓', title: 'Отправлено' },
  delivered: { text: '✓✓', title: 'Доставлено' },
  read: { text: '✓✓', title: 'Прочитано' },
  failed: { text: 'не отправлено', title: 'Не отправлено' },
}

interface ChatWindowProps {
  chat: Chat
  avatarUrl: string | null | undefined
  onBack: () => void
  onSend: (text: string) => void
  onRetry: (message: Message) => void
}

export function ChatWindow({ chat, avatarUrl, onBack, onSend, onRetry }: ChatWindowProps) {
  const title = chatTitle(chat)
  const subtitle = chat.phone ? formatPhone(chat.phone) : `Telegram ID ${chat.chatIds[0]}`
  const listRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.id, chat.messages.length])

  return (
    <section className="chat" aria-label={`Чат: ${title}`}>
      <div className="chat__header">
        <button type="button" className="chat__back" onClick={onBack}>
          ← Назад
        </button>
        <Avatar title={title} url={avatarUrl} />
        <div>
          <strong>{title}</strong>
          {subtitle !== title && <div className="muted">{subtitle}</div>}
        </div>
      </div>

      <div className="messages" ref={listRef} role="log" aria-live="polite">
        {chat.messages.length === 0 && <p className="muted center">Сообщений пока нет</p>}
        {chat.messages.map((message) => (
          <div key={message.id} className={`message message--${message.direction}`}>
            <div className={`message__text${message.unsupported ? ' muted' : ''}`}>{message.text}</div>
            <div className="message__meta">
              {formatMessageTime(message.timestamp)}
              {message.direction === 'out' && message.status && (
                <>
                  {' · '}
                  <span className={`status--${message.status}`} title={STATUS_VIEW[message.status].title}>
                    {STATUS_VIEW[message.status].text}
                  </span>
                </>
              )}
            </div>
            {message.status === 'failed' && (
              <div className="error">
                {message.error ?? 'Не удалось отправить'}{' '}
                <button type="button" className="link" onClick={() => onRetry(message)}>
                  Повторить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Composer key={chat.id} onSend={onSend} />
    </section>
  )
}

function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  function submit() {
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className="composer row" onSubmit={handleSubmit}>
      <textarea
        rows={2}
        placeholder="Сообщение"
        aria-label="Сообщение"
        maxLength={MAX_MESSAGE_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <button type="submit" disabled={!trimmed}>
        Отправить
      </button>
    </form>
  )
}
