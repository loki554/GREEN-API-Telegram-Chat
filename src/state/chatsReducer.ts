import type { ChatEvent } from '../lib/notifications'
import { phoneFromChatId, phoneToChatId } from '../lib/phone'
import type { Chat, ChatsState, Message, MessageStatus } from './types'

export type ChatsAction =
  | { type: 'createChat'; phone: string; now: number }
  | { type: 'openChat'; chatId: string }
  | { type: 'closeChat' }
  | { type: 'sendStart'; chatId: string; tempId: string; text: string; timestamp: number }
  | { type: 'sendSuccess'; chatId: string; tempId: string; idMessage: string }
  | { type: 'sendFailure'; chatId: string; tempId: string; error: string }
  | { type: 'removeMessage'; chatId: string; messageId: string }
  | { type: 'event'; event: ChatEvent }

export const initialChatsState: ChatsState = { chats: [], activeChatId: null, pendingStatuses: {} }

const STATUS_RANK: Record<MessageStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }

function mergeStatus(current: MessageStatus | undefined, next: MessageStatus): MessageStatus {
  if (!current) return next
  // «failed» может прийти только до доставки; прочтение/доставка не откатываются назад
  if (next === 'failed') return current === 'pending' || current === 'sent' ? 'failed' : current
  if (current === 'failed') return next
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current
}

function updateChat(state: ChatsState, chatId: string, update: (chat: Chat) => Chat): ChatsState {
  return { ...state, chats: state.chats.map((chat) => (chat.id === chatId ? update(chat) : chat)) }
}

function insertMessage(messages: Message[], message: Message): Message[] {
  const index = messages.findIndex((m) => m.timestamp > message.timestamp)
  if (index === -1) return [...messages, message]
  return [...messages.slice(0, index), message, ...messages.slice(index)]
}

function addChatId(chat: Chat, chatId: string | null): Chat {
  if (!chatId || chat.chatIds.includes(chatId)) return chat
  return { ...chat, chatIds: [...chat.chatIds, chatId] }
}

export function findChat(chats: Chat[], chatId: string | null, phone: string | null): Chat | undefined {
  const phoneFromId = chatId ? phoneFromChatId(chatId) : null
  return chats.find(
    (chat) =>
      (chatId !== null && chat.chatIds.includes(chatId)) ||
      (chat.phone !== null && (chat.phone === phone || chat.phone === phoneFromId)),
  )
}

function findChatByMessageId(chats: Chat[], messageId: string): Chat | undefined {
  return chats.find((chat) => chat.messages.some((m) => m.id === messageId))
}

export function sendTargetFor(chat: Chat): string {
  return chat.phone ? phoneToChatId(chat.phone) : chat.chatIds[0]
}

/** Telegram ID, если он уже известен, иначе номер. */
export function avatarTargetFor(chat: Chat): string {
  return chat.chatIds.find((id) => !id.endsWith('@c.us')) ?? sendTargetFor(chat)
}

export function lastActivity(chat: Chat): number {
  return chat.messages.at(-1)?.timestamp ?? chat.createdAt
}

function applyStatus(state: ChatsState, idMessage: string, chatId: string | null, status: MessageStatus): ChatsState {
  const chat = findChatByMessageId(state.chats, idMessage)
  if (!chat) {
    const previous = state.pendingStatuses[idMessage]
    return { ...state, pendingStatuses: { ...state.pendingStatuses, [idMessage]: mergeStatus(previous, status) } }
  }
  return updateChat(state, chat.id, (c) =>
    addChatId(
      {
        ...c,
        messages: c.messages.map((m) => (m.id === idMessage ? { ...m, status: mergeStatus(m.status, status) } : m)),
      },
      chatId,
    ),
  )
}

function applyMessage(state: ChatsState, event: Extract<ChatEvent, { kind: 'message' }>): ChatsState {
  const { message, chatId, phone, chatName } = event
  // Исходящее сообщение, отправленное из этого интерфейса: связываем Telegram chatId с чатом по idMessage
  const byMessageId = findChatByMessageId(state.chats, message.id)
  const chat = byMessageId ?? findChat(state.chats, chatId, phone)

  if (!chat) {
    const newChat: Chat = {
      id: phone ? `phone:${phone}` : `chat:${chatId}`,
      phone,
      chatIds: [chatId],
      name: chatName,
      messages: [message],
      unread: message.direction === 'in' ? 1 : 0,
      createdAt: message.timestamp,
    }
    return { ...state, chats: [newChat, ...state.chats] }
  }

  const isDuplicate = chat.messages.some((m) => m.id === message.id)
  const isActive = state.activeChatId === chat.id
  return updateChat(state, chat.id, (c) => {
    const updated = addChatId(c, chatId)
    return {
      ...updated,
      phone: updated.phone ?? phone,
      name: chatName ?? updated.name,
      messages: isDuplicate ? updated.messages : insertMessage(updated.messages, message),
      unread: !isDuplicate && !isActive && message.direction === 'in' ? updated.unread + 1 : updated.unread,
    }
  })
}

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case 'createChat': {
      const existing = findChat(state.chats, phoneToChatId(action.phone), action.phone)
      if (existing) return chatsReducer(state, { type: 'openChat', chatId: existing.id })
      const chat: Chat = {
        id: `phone:${action.phone}`,
        phone: action.phone,
        chatIds: [phoneToChatId(action.phone)],
        name: null,
        messages: [],
        unread: 0,
        createdAt: action.now,
      }
      return { ...state, chats: [chat, ...state.chats], activeChatId: chat.id }
    }

    case 'openChat':
      return { ...updateChat(state, action.chatId, (c) => ({ ...c, unread: 0 })), activeChatId: action.chatId }

    case 'closeChat':
      return { ...state, activeChatId: null }

    case 'sendStart':
      return updateChat(state, action.chatId, (c) => ({
        ...c,
        messages: insertMessage(c.messages, {
          id: action.tempId,
          direction: 'out',
          text: action.text,
          timestamp: action.timestamp,
          status: 'pending',
        }),
      }))

    case 'sendSuccess': {
      const { [action.idMessage]: pendingStatus, ...pendingStatuses } = state.pendingStatuses
      const alreadyKnown = findChatByMessageId(state.chats, action.idMessage)
      const next = updateChat({ ...state, pendingStatuses }, action.chatId, (c) => ({
        ...c,
        messages: alreadyKnown
          ? // уведомление outgoingAPIMessageReceived пришло раньше ответа sendMessage - убираем дубль
            c.messages.filter((m) => m.id !== action.tempId)
          : c.messages.map((m) =>
              m.id === action.tempId
                ? { ...m, id: action.idMessage, status: mergeStatus('sent', pendingStatus ?? 'sent') }
                : m,
            ),
      }))
      return next
    }

    case 'sendFailure':
      return updateChat(state, action.chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === action.tempId ? { ...m, status: 'failed', error: action.error } : m)),
      }))

    case 'removeMessage':
      return updateChat(state, action.chatId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.id !== action.messageId),
      }))

    case 'event': {
      const { event } = action
      if (event.kind === 'status') return applyStatus(state, event.idMessage, event.chatId, event.status)
      if (event.kind === 'message') return applyMessage(state, event)
      return state
    }
  }
}
