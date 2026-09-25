import type { NotificationBody } from '../api/types'
import { parseNotification } from './notifications'

const instanceData = { idInstance: 4100000001, wid: '79000000000@c.us', typeInstance: 'telegram' }

function incomingText(overrides: Partial<NotificationBody> = {}): NotificationBody {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData,
    timestamp: 1763115112,
    idMessage: 'IN1',
    senderData: {
      chatId: '10000000',
      chatName: 'Василиса',
      sender: '10000000',
      senderName: 'Василиса Премудрая',
      senderContactName: '',
      senderPhoneNumber: 79876543210,
    },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет от Green-API!' } },
    ...overrides,
  }
}

describe('parseNotification', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(parseNotification(incomingText())).toEqual({
      kind: 'message',
      chatId: '10000000',
      phone: '79876543210',
      chatName: 'Василиса Премудрая',
      message: {
        id: 'IN1',
        direction: 'in',
        text: 'Привет от Green-API!',
        timestamp: 1763115112000,
        status: undefined,
        unsupported: undefined,
      },
    })
  })

  it('берёт текст из extendedTextMessage и quotedMessage', () => {
    for (const typeMessage of ['extendedTextMessage', 'quotedMessage']) {
      const event = parseNotification(
        incomingText({ messageData: { typeMessage, extendedTextMessageData: { text: 'https://green-api.com' } } }),
      )
      expect(event.kind === 'message' && event.message.text).toBe('https://green-api.com')
    }
  })

  it('заменяет нетекстовые сообщения заглушкой', () => {
    const event = parseNotification(incomingText({ messageData: { typeMessage: 'imageMessage' } }))
    expect(event).toMatchObject({
      kind: 'message',
      message: { text: 'Фото - этот тип сообщений не поддерживается', unsupported: true },
    })
  })

  it('не берёт собственный номер инстанса как номер собеседника', () => {
    const event = parseNotification(
      incomingText({ senderData: { chatId: '10000000', senderPhoneNumber: 79000000000 } }),
    )
    expect(event).toMatchObject({ kind: 'message', phone: null })
  })

  it('для исходящих не использует senderPhoneNumber (это номер отправителя)', () => {
    const event = parseNotification(
      incomingText({
        typeWebhook: 'outgoingMessageReceived',
        idMessage: 'OUT1',
        senderData: { chatId: '10000000', chatName: 'Василиса', senderPhoneNumber: 79111111111 },
      }),
    )
    expect(event).toMatchObject({
      kind: 'message',
      phone: null,
      chatName: 'Василиса',
      message: { id: 'OUT1', direction: 'out', status: 'sent' },
    })
  })

  it('извлекает номер из chatId вида 79…@c.us', () => {
    const event = parseNotification(
      incomingText({ typeWebhook: 'outgoingAPIMessageReceived', senderData: { chatId: '79991234567@c.us' } }),
    )
    expect(event).toMatchObject({ kind: 'message', phone: '79991234567', message: { direction: 'out' } })
  })

  it('игнорирует групповые чаты', () => {
    expect(parseNotification(incomingText({ senderData: { chatId: '-10000000000000' } }))).toEqual({ kind: 'ignore' })
    expect(
      parseNotification(incomingText({ senderData: { chatId: '123', chatType: 'supergroup' } })),
    ).toEqual({ kind: 'ignore' })
  })

  it('разбирает статусы исходящих сообщений', () => {
    const status = (value: string) =>
      parseNotification({
        typeWebhook: 'outgoingMessageStatus',
        timestamp: 1,
        chatId: '10000000',
        idMessage: 'OUT1',
        status: value,
      })
    expect(status('read')).toEqual({ kind: 'status', idMessage: 'OUT1', chatId: '10000000', status: 'read' })
    expect(status('noAccount')).toMatchObject({ status: 'failed' })
    expect(status('unknown')).toEqual({ kind: 'ignore' })
  })

  it('игнорирует служебные уведомления', () => {
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', timestamp: 1 })).toEqual({ kind: 'ignore' })
  })
})
