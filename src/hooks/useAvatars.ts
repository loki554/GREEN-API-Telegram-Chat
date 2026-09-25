import { useEffect, useRef, useState } from 'react'
import type { GreenApiClient } from '../api/greenApi'
import { avatarTargetFor } from '../state/chatsReducer'
import type { Chat } from '../state/types'

/** Ссылки не сохраняются в localStorage: срок их жизни не гарантирован. */
export function useAvatars(client: GreenApiClient, chats: Chat[]): Record<string, string | null> {
  const [avatars, setAvatars] = useState<Record<string, string | null>>({})
  const requested = useRef(new Set<string>())

  useEffect(() => {
    for (const chat of chats) {
      const target = avatarTargetFor(chat)
      if (requested.current.has(target)) continue
      requested.current.add(target)
      client
        .getAvatar(target)
        .then(({ urlAvatar }) => urlAvatar || null)
        .catch(() => null)
        .then((url) => setAvatars((prev) => ({ ...prev, [target]: url })))
    }
  }, [client, chats])

  return avatars
}
