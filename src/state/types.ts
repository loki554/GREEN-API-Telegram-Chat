export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Message {
  /** idMessage из GREEN-API; для ещё не отправленных - локальный временный id. */
  id: string
  direction: 'in' | 'out'
  text: string
  /** Время в миллисекундах. */
  timestamp: number
  status?: MessageStatus
  error?: string
  unsupported?: boolean
}

export interface Chat {
  /** Локальный идентификатор: «phone:<номер>» или «chat:<chatId Telegram>». */
  id: string
  phone: string | null
  /** Все известные chatId собеседника: «79001234567@c.us» и числовой Telegram ID. */
  chatIds: string[]
  name: string | null
  messages: Message[]
  unread: number
  createdAt: number
}

export interface ChatsState {
  chats: Chat[]
  activeChatId: string | null
  /** Статусы, пришедшие раньше, чем sendMessage вернул idMessage. */
  pendingStatuses: Record<string, MessageStatus>
}
