import type { ChatEvent } from '../lib/notifications'
import { chatsReducer, initialChatsState, sendTargetFor, type ChatsAction } from './chatsReducer'
import type { ChatsState, Message } from './types'

const PHONE = '79991234567'
const CHAT_ID = `phone:${PHONE}`

function run(...actions: ChatsAction[]): ChatsState {
  return actions.reduce(chatsReducer, initialChatsState)
}

function incoming(overrides: Partial<Message> = {}, chatId = '10000000', phone: string | null = PHONE): ChatEvent {
  return {
    kind: 'message',
    chatId,
    phone,
    chatName: 'Иван',
    message: { id: 'IN1', direction: 'in', text: 'Ответ', timestamp: 2000, ...overrides },
  }
}

const create: ChatsAction = { type: 'createChat', phone: PHONE, now: 1000 }
const sendStart: ChatsAction = { type: 'sendStart', chatId: CHAT_ID, tempId: 'tmp', text: 'Привет', timestamp: 1500 }

describe('chatsReducer', () => {
  it('создаёт чат по номеру и делает его активным', () => {
    const state = run(create)
    expect(state.activeChatId).toBe(CHAT_ID)
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0]).toMatchObject({ phone: PHONE, chatIds: [`${PHONE}@c.us`], messages: [] })
    expect(sendTargetFor(state.chats[0])).toBe(`${PHONE}@c.us`)
  })

  it('повторное создание открывает существующий чат', () => {
    const state = run(create, { type: 'closeChat' }, { ...create, now: 5000 })
    expect(state.chats).toHaveLength(1)
    expect(state.activeChatId).toBe(CHAT_ID)
  })

  it('заменяет временный id на idMessage после успешной отправки', () => {
    const state = run(create, sendStart, { type: 'sendSuccess', chatId: CHAT_ID, tempId: 'tmp', idMessage: 'M1' })
    expect(state.chats[0].messages).toEqual([
      { id: 'M1', direction: 'out', text: 'Привет', timestamp: 1500, status: 'sent' },
    ])
  })

  it('помечает сообщение как неотправленное при ошибке', () => {
    const state = run(create, sendStart, { type: 'sendFailure', chatId: CHAT_ID, tempId: 'tmp', error: 'Ошибка' })
    expect(state.chats[0].messages[0]).toMatchObject({ status: 'failed', error: 'Ошибка' })
  })

  it('кладёт ответ в чат, созданный по номеру, и запоминает Telegram chatId', () => {
    const state = run(create, { type: 'event', event: incoming() })
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0].messages.map((m) => m.text)).toEqual(['Ответ'])
    expect(state.chats[0].chatIds).toEqual([`${PHONE}@c.us`, '10000000'])
    expect(state.chats[0].name).toBe('Иван')
    expect(state.chats[0].unread).toBe(0)

    // следующее сообщение без номера телефона находится по запомненному chatId
    const next = chatsReducer(state, { type: 'event', event: incoming({ id: 'IN2', timestamp: 3000 }, '10000000', null) })
    expect(next.chats).toHaveLength(1)
    expect(next.chats[0].messages).toHaveLength(2)
  })

  it('связывает чат с Telegram chatId по idMessage исходящего уведомления', () => {
    const outgoing: ChatEvent = {
      kind: 'message',
      chatId: '10000000',
      phone: null,
      chatName: 'Иван',
      message: { id: 'M1', direction: 'out', text: 'Привет', timestamp: 1600, status: 'sent' },
    }
    const state = run(
      create,
      sendStart,
      { type: 'sendSuccess', chatId: CHAT_ID, tempId: 'tmp', idMessage: 'M1' },
      { type: 'event', event: outgoing },
      { type: 'event', event: incoming({}, '10000000', null) },
    )
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0].messages.map((m) => m.id)).toEqual(['M1', 'IN1'])
  })

  it('не дублирует сообщение, если уведомление пришло раньше ответа sendMessage', () => {
    const outgoing: ChatEvent = {
      kind: 'message',
      chatId: `${PHONE}@c.us`,
      phone: PHONE,
      chatName: null,
      message: { id: 'M1', direction: 'out', text: 'Привет', timestamp: 1600, status: 'sent' },
    }
    const state = run(create, sendStart, { type: 'event', event: outgoing }, {
      type: 'sendSuccess',
      chatId: CHAT_ID,
      tempId: 'tmp',
      idMessage: 'M1',
    })
    expect(state.chats[0].messages.map((m) => m.id)).toEqual(['M1'])
  })

  it('игнорирует повторно полученное уведомление', () => {
    const state = run(create, { type: 'event', event: incoming() }, { type: 'event', event: incoming() })
    expect(state.chats[0].messages).toHaveLength(1)
  })

  it('создаёт чат для сообщения от неизвестного собеседника и считает непрочитанные', () => {
    const state = run({ type: 'event', event: incoming({}, '555', null) })
    expect(state.chats[0]).toMatchObject({ id: 'chat:555', phone: null, chatIds: ['555'], unread: 1 })
    expect(sendTargetFor(state.chats[0])).toBe('555')

    const opened = chatsReducer(state, { type: 'openChat', chatId: 'chat:555' })
    expect(opened.chats[0].unread).toBe(0)
  })

  it('сортирует сообщения по времени', () => {
    const state = run(
      create,
      { type: 'event', event: incoming({ id: 'late', timestamp: 3000 }) },
      { type: 'event', event: incoming({ id: 'early', timestamp: 2000 }) },
    )
    expect(state.chats[0].messages.map((m) => m.id)).toEqual(['early', 'late'])
  })

  describe('статусы', () => {
    const sent = [create, sendStart, { type: 'sendSuccess', chatId: CHAT_ID, tempId: 'tmp', idMessage: 'M1' }] as const
    const status = (value: 'sent' | 'delivered' | 'read' | 'failed'): ChatsAction => ({
      type: 'event',
      event: { kind: 'status', idMessage: 'M1', chatId: '10000000', status: value },
    })

    it('обновляет статус и не откатывает его назад', () => {
      const state = run(...sent, status('read'), status('delivered'))
      expect(state.chats[0].messages[0].status).toBe('read')
      expect(state.chats[0].chatIds).toContain('10000000')
    })

    it('применяет статус, пришедший раньше ответа sendMessage', () => {
      const state = run(create, sendStart, status('delivered'), {
        type: 'sendSuccess',
        chatId: CHAT_ID,
        tempId: 'tmp',
        idMessage: 'M1',
      })
      expect(state.chats[0].messages[0].status).toBe('delivered')
      expect(state.pendingStatuses).toEqual({})
    })

    it('failed после доставки игнорируется', () => {
      expect(run(...sent, status('delivered'), status('failed')).chats[0].messages[0].status).toBe('delivered')
      expect(run(...sent, status('failed')).chats[0].messages[0].status).toBe('failed')
    })
  })
})
