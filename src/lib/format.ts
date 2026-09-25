import type { Chat } from '../state/types'
import { formatPhone } from './phone'

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })

function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function formatMessageTime(ts: number, now = Date.now()): string {
  return isSameDay(ts, now) ? timeFormat.format(ts) : `${dateFormat.format(ts)} ${timeFormat.format(ts)}`
}

export function chatTitle(chat: Chat): string {
  if (chat.name) return chat.name
  if (chat.phone) return formatPhone(chat.phone)
  return `ID ${chat.chatIds[0]}`
}
