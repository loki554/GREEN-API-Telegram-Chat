import { useCallback, useMemo } from 'react'
import { GreenApiClient } from '../api/greenApi'
import type { Credentials, NotificationBody } from '../api/types'
import { useAvatars } from '../hooks/useAvatars'
import { useChats } from '../hooks/useChats'
import { useNotificationPolling } from '../hooks/useNotificationPolling'
import { parseNotification } from '../lib/notifications'
import { avatarTargetFor, sendTargetFor } from '../state/chatsReducer'
import type { Chat, Message } from '../state/types'
import { ChatWindow } from './ChatWindow'
import { SettingsBanner } from './SettingsBanner'
import { Sidebar } from './Sidebar'

interface ChatScreenProps {
  credentials: Credentials
  onLogout: () => void
}

function createTempId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function ChatScreen({ credentials, onLogout }: ChatScreenProps) {
  const client = useMemo(() => new GreenApiClient(credentials), [credentials])
  const [state, dispatch] = useChats(credentials.idInstance)

  const handleNotification = useCallback(
    (body: NotificationBody) => dispatch({ type: 'event', event: parseNotification(body) }),
    [dispatch],
  )
  const polling = useNotificationPolling(client, handleNotification)
  const avatars = useAvatars(client, state.chats)

  const activeChat = state.chats.find((chat) => chat.id === state.activeChatId) ?? null

  const sendText = useCallback(
    async (chat: Chat, text: string) => {
      const tempId = createTempId()
      dispatch({ type: 'sendStart', chatId: chat.id, tempId, text, timestamp: Date.now() })
      try {
        const { idMessage } = await client.sendMessage(sendTargetFor(chat), text)
        dispatch({ type: 'sendSuccess', chatId: chat.id, tempId, idMessage })
      } catch (e) {
        dispatch({ type: 'sendFailure', chatId: chat.id, tempId, error: e instanceof Error ? e.message : String(e) })
      }
    },
    [client, dispatch],
  )

  const retry = useCallback(
    (chat: Chat, message: Message) => {
      dispatch({ type: 'removeMessage', chatId: chat.id, messageId: message.id })
      void sendText(chat, message.text)
    },
    [dispatch, sendText],
  )

  return (
    <div className="screen">
      <SettingsBanner client={client} />
      <div className={`app${activeChat ? ' app--chat-open' : ''}`}>
        <Sidebar
          chats={state.chats}
          avatars={avatars}
          activeChatId={state.activeChatId}
          idInstance={credentials.idInstance}
          pollingStatus={polling.status}
          pollingError={polling.error}
          onOpenChat={(chatId) => dispatch({ type: 'openChat', chatId })}
          onCreateChat={(phone) => dispatch({ type: 'createChat', phone, now: Date.now() })}
          onLogout={onLogout}
        />
        <main className="main">
          {activeChat ? (
            <ChatWindow
              chat={activeChat}
              avatarUrl={avatars[avatarTargetFor(activeChat)]}
              onBack={() => dispatch({ type: 'closeChat' })}
              onSend={(text) => void sendText(activeChat, text)}
              onRetry={(message) => retry(activeChat, message)}
            />
          ) : (
            <p className="muted center">Выберите чат или создайте новый по номеру телефона</p>
          )}
        </main>
      </div>
    </div>
  )
}
