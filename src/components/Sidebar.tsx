import { useState, type FormEvent } from 'react'
import type { PollingStatus } from '../hooks/useNotificationPolling'
import { chatTitle } from '../lib/format'
import { normalizePhone } from '../lib/phone'
import { avatarTargetFor, lastActivity } from '../state/chatsReducer'
import type { Chat } from '../state/types'
import { Avatar } from './Avatar'

interface SidebarProps {
  chats: Chat[]
  avatars: Record<string, string | null>
  activeChatId: string | null
  idInstance: string
  pollingStatus: PollingStatus
  pollingError: string | null
  onOpenChat: (chatId: string) => void
  onCreateChat: (phone: string) => void
  onLogout: () => void
}

const STATUS_TEXT: Record<PollingStatus, string> = {
  connecting: 'подключение…',
  online: 'получение сообщений активно',
  error: 'ошибка получения сообщений',
}

export function Sidebar(props: SidebarProps) {
  const { chats, avatars, activeChatId, idInstance, pollingStatus, pollingError, onOpenChat, onCreateChat, onLogout } = props
  const sortedChats = [...chats].sort((a, b) => lastActivity(b) - lastActivity(a))

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div>
          <div>Инстанс {idInstance}</div>
          <div className={`status status--${pollingStatus}`}>
            {STATUS_TEXT[pollingStatus]}
            {pollingStatus === 'error' && pollingError && `: ${pollingError}`}
          </div>
        </div>
        <button type="button" onClick={onLogout}>
          Выйти
        </button>
      </div>

      <NewChatForm onSubmit={onCreateChat} />

      {chats.length === 0 ? (
        <p className="sidebar__empty">Чатов пока нет</p>
      ) : (
        <ul className="chat-list" aria-label="Чаты">
          {sortedChats.map((chat) => {
            const last = chat.messages.at(-1)
            return (
              <li key={chat.id}>
                <button
                  type="button"
                  className={`chat-item${chat.id === activeChatId ? ' chat-item--active' : ''}`}
                  onClick={() => onOpenChat(chat.id)}
                >
                  <Avatar title={chatTitle(chat)} url={avatars[avatarTargetFor(chat)]} />
                  <span className="chat-item__body">
                    <span className="chat-item__row">
                      <span className="chat-item__title">{chatTitle(chat)}</span>
                      {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                    </span>
                    <span className="chat-item__preview">
                      {last ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}` : 'Нет сообщений'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

function NewChatForm({ onSubmit }: { onSubmit: (phone: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const phone = normalizePhone(value)
    if (!phone) {
      setError('Введите номер в международном формате, например 79991234567')
      return
    }
    onSubmit(phone)
    setValue('')
    setError(null)
  }

  return (
    <form className="new-chat" onSubmit={handleSubmit} noValidate>
      <div className="row">
        <input
          type="tel"
          inputMode="tel"
          placeholder="Номер получателя"
          aria-label="Номер телефона получателя"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
        />
        <button type="submit">Создать чат</button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
