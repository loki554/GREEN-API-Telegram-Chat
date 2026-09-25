import type { MessageData, NotificationBody } from '../api/types'
import type { Message, MessageStatus } from '../state/types'
import { phoneFromChatId } from './phone'

export interface MessageEvent {
  kind: 'message'
  chatId: string
  phone: string | null
  chatName: string | null
  message: Message
}

export interface StatusEvent {
  kind: 'status'
  idMessage: string
  chatId: string | null
  status: MessageStatus
}

export type ChatEvent = MessageEvent | StatusEvent | { kind: 'ignore' }

const IGNORE = { kind: 'ignore' } as const

const UNSUPPORTED_LABELS: Record<string, string> = {
  imageMessage: 'Фото',
  videoMessage: 'Видео',
  audioMessage: 'Аудио',
  documentMessage: 'Документ',
  stickerMessage: 'Стикер',
  locationMessage: 'Геопозиция',
  contactMessage: 'Контакт',
  pollMessage: 'Опрос',
}

const STATUS_MAP: Record<string, MessageStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
  yellowCard: 'failed',
}

function extractText(data: MessageData | undefined): string | null {
  if (!data) return null
  switch (data.typeMessage) {
    case 'textMessage':
      return data.textMessageData?.textMessage ?? null
    case 'extendedTextMessage':
    case 'quotedMessage':
      return data.extendedTextMessageData?.text ?? null
    default:
      return null
  }
}

function isGroupChat(chatId: string, chatType?: string): boolean {
  return (
    chatId.startsWith('-') ||
    chatId.endsWith('@g.us') ||
    chatType === 'group' ||
    chatType === 'supergroup' ||
    chatType === 'channel'
  )
}

function toPhone(value: number | string | undefined, ownPhone: string | null): string | null {
  if (value === undefined || value === null) return null
  const digits = String(value).replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15 || digits === ownPhone) return null
  return digits
}

export function parseNotification(body: NotificationBody): ChatEvent {
  const ownPhone = body.instanceData?.wid ? phoneFromChatId(body.instanceData.wid) : null

  if (body.typeWebhook === 'outgoingMessageStatus') {
    const status = body.status ? STATUS_MAP[body.status] : undefined
    if (!status || !body.idMessage) return IGNORE
    return { kind: 'status', idMessage: body.idMessage, chatId: body.chatId ?? null, status }
  }

  const direction =
    body.typeWebhook === 'incomingMessageReceived'
      ? 'in'
      : body.typeWebhook === 'outgoingMessageReceived' || body.typeWebhook === 'outgoingAPIMessageReceived'
        ? 'out'
        : null
  const sender = body.senderData
  if (!direction || !sender?.chatId || !body.idMessage) return IGNORE
  if (isGroupChat(sender.chatId, sender.chatType)) return IGNORE

  const text = extractText(body.messageData)
  const unsupported = text === null
  const label = UNSUPPORTED_LABELS[body.messageData?.typeMessage ?? ''] ?? 'Сообщение'

  // В исходящих senderData описывает отправителя (нас), поэтому номер собеседника берём только из chatId.
  const phone =
    phoneFromChatId(sender.chatId) ?? (direction === 'in' ? toPhone(sender.senderPhoneNumber, ownPhone) : null)
  const chatName = (direction === 'in' ? sender.senderContactName || sender.senderName : null) || sender.chatName || null

  return {
    kind: 'message',
    chatId: sender.chatId,
    phone,
    chatName,
    message: {
      id: body.idMessage,
      direction,
      text: unsupported ? `${label} - этот тип сообщений не поддерживается` : text,
      timestamp: body.timestamp * 1000,
      status: direction === 'out' ? 'sent' : undefined,
      unsupported: unsupported || undefined,
    },
  }
}
