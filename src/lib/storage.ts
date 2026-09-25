import type { Credentials } from '../api/types'
import type { ChatsState } from '../state/types'
import { initialChatsState } from '../state/chatsReducer'

const CREDENTIALS_KEY = 'green-chat:credentials'
const chatsKey = (idInstance: string) => `green-chat:chats:${idInstance}`

// localStorage может быть недоступен (приватный режим, запрет cookies) - приложение работает и без него.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
  }
}

export function loadCredentials(): Credentials | null {
  const value = read<Credentials>(CREDENTIALS_KEY)
  return value?.apiUrl && value.idInstance && value.apiTokenInstance ? value : null
}

export function saveCredentials(credentials: Credentials): void {
  write(CREDENTIALS_KEY, credentials)
}

export function clearCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_KEY)
  } catch {
  }
}

export function loadChats(idInstance: string): ChatsState {
  const stored = read<Pick<ChatsState, 'chats'>>(chatsKey(idInstance))
  if (!Array.isArray(stored?.chats)) return initialChatsState
  return {
    ...initialChatsState,
    // Отправка, прерванная перезагрузкой страницы, считается неудачной - её можно повторить
    chats: stored.chats.map((chat) => ({
      ...chat,
      messages: chat.messages.map((m) =>
        m.status === 'pending' ? { ...m, status: 'failed' as const, error: 'Отправка прервана' } : m,
      ),
    })),
  }
}

export function saveChats(idInstance: string, state: ChatsState): void {
  write(chatsKey(idInstance), { chats: state.chats })
}
