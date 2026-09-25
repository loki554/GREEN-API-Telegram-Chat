import { useEffect, useReducer } from 'react'
import { chatsReducer } from '../state/chatsReducer'
import { loadChats, saveChats } from '../lib/storage'

export function useChats(idInstance: string) {
  const [state, dispatch] = useReducer(chatsReducer, idInstance, loadChats)

  useEffect(() => {
    saveChats(idInstance, state)
  }, [idInstance, state])

  return [state, dispatch] as const
}
