import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { InstanceSettings, NotificationBody } from './api/types'
import { App } from './App'
import { REQUIRED_SETTINGS } from './components/SettingsBanner'

// минимальная эмуляция GREEN-API: маршрутизирует запросы по имени метода
function createFakeServer() {
  const queue: { receiptId: number; body: NotificationBody }[] = []
  const deleted: number[] = []
  const sent: { chatId: string; message: string }[] = []
  const avatars: Record<string, string> = {}
  const avatarRequests: string[] = []
  let settings: InstanceSettings = { ...REQUIRED_SETTINGS }
  let authStatus = 200
  let nextReceiptId = 1

  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    const method = url.pathname.split('/')[2]
    if (authStatus !== 200) return new Response('', { status: authStatus })

    switch (method) {
      case 'getStateInstance':
        return json({ stateInstance: 'authorized' })
      case 'getSettings':
        return json(settings)
      case 'setSettings':
        settings = { ...settings, ...JSON.parse(String(init?.body)) }
        return json({ saveSettings: true })
      case 'sendMessage':
        sent.push(JSON.parse(String(init?.body)))
        return json({ idMessage: `MSG${sent.length}` })
      case 'getAvatar': {
        const { chatId } = JSON.parse(String(init?.body)) as { chatId: string }
        avatarRequests.push(chatId)
        return json({ urlAvatar: avatars[chatId] ?? '' })
      }
      case 'receiveNotification': {
        const next = queue.find((n) => !deleted.includes(n.receiptId))
        if (next) return json(next)
        await new Promise((resolve) => setTimeout(resolve, 20))
        return new Response('', { status: 200 })
      }
      case 'deleteNotification':
        deleted.push(Number(url.pathname.split('/').at(-1)))
        return json({ result: true })
      default:
        return new Response('', { status: 404 })
    }
  })

  return {
    fetchMock,
    sent,
    deleted,
    avatars,
    avatarRequests,
    get settings() {
      return settings
    },
    setSettings(value: InstanceSettings) {
      settings = value
    },
    setAuthStatus(status: number) {
      authStatus = status
    },
    push(body: NotificationBody) {
      const receiptId = nextReceiptId++
      queue.push({ receiptId, body })
      return receiptId
    },
  }
}

let server: ReturnType<typeof createFakeServer>

beforeEach(() => {
  server = createFakeServer()
  vi.stubGlobal('fetch', server.fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function login(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('idInstance'), '1101000001')
  await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token')
  expect(screen.getByLabelText('apiUrl')).toHaveValue('https://1101.api.green-api.com')
  await user.click(screen.getByRole('button', { name: 'Войти' }))
  await screen.findByText('Инстанс 1101000001')
}

const replyNotification = (text: string, idMessage: string): NotificationBody => ({
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 1101000001, wid: '79000000000@c.us', typeInstance: 'telegram' },
  timestamp: Math.floor(Date.now() / 1000) + 1,
  idMessage,
  senderData: {
    chatId: '10000000',
    chatName: 'Иван',
    sender: '10000000',
    senderName: 'Иван Петров',
    senderPhoneNumber: 79991234567,
  },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
})

describe('App', () => {
  it('полный сценарий: вход → новый чат → отправка → ответ получателя', async () => {
    const user = userEvent.setup()
    render(<App />)
    await login(user)

    await user.type(screen.getByLabelText('Номер телефона получателя'), '8 (999) 123-45-67')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))
    const chat = await screen.findByRole('region', { name: 'Чат: +7 999 123-45-67' })

    await user.type(within(chat).getByLabelText('Сообщение'), 'Привет!{Enter}')
    await waitFor(() => expect(server.sent).toEqual([{ chatId: '79991234567@c.us', message: 'Привет!' }]))
    expect(within(chat).getByText('Привет!')).toBeInTheDocument()
    expect(await within(chat).findByTitle('Отправлено')).toHaveTextContent('✓')
    expect(within(chat).getByLabelText('Сообщение')).toHaveValue('')

    // ответ приходит от Telegram ID, чат находится по номеру телефона
    const receiptId = server.push(replyNotification('Привет, получил', 'IN1'))
    expect(await within(screen.getByRole('log')).findByText('Привет, получил', {}, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => expect(server.deleted).toContain(receiptId))

    server.push({
      typeWebhook: 'outgoingMessageStatus',
      timestamp: Math.floor(Date.now() / 1000) + 2,
      chatId: '10000000',
      idMessage: 'MSG1',
      status: 'read',
    })
    const readTicks = await screen.findByTitle('Прочитано', {}, { timeout: 3000 })
    expect(readTicks).toHaveTextContent('✓✓')
    expect(readTicks).toHaveClass('status--read')
    expect(screen.queryByTitle('Отправлено')).not.toBeInTheDocument()

    const chatList = screen.getByRole('list', { name: 'Чаты' })
    expect(within(chatList).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Чат: Иван Петров' })).toBeInTheDocument()
  })

  it('подгружает аватар собеседника, пока его нет - показывает инициалы', async () => {
    server.avatars['10000000'] = 'https://example.com/avatar.jpg'
    const user = userEvent.setup()
    render(<App />)
    await login(user)
    await user.type(screen.getByLabelText('Номер телефона получателя'), '79991234567')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))

    const chatList = screen.getByRole('list', { name: 'Чаты' })
    await waitFor(() => expect(server.avatarRequests).toEqual(['79991234567@c.us']))
    expect(within(chatList).getByText('67')).toBeInTheDocument()

    // после ответа известен Telegram ID - аватар запрашивается по нему
    server.push(replyNotification('Привет', 'IN1'))
    await waitFor(() => expect(server.avatarRequests).toEqual(['79991234567@c.us', '10000000']), { timeout: 3000 })
    await waitFor(() =>
      expect(chatList.querySelector('img.avatar')).toHaveAttribute('src', 'https://example.com/avatar.jpg'),
    )
    expect(document.querySelector('.chat__header img.avatar')).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('удаляет из очереди и неподдерживаемые уведомления, чтобы не блокировать её', async () => {
    const user = userEvent.setup()
    render(<App />)
    const stateReceipt = server.push({ typeWebhook: 'stateInstanceChanged', timestamp: 1 })
    await login(user)

    const messageReceipt = server.push(replyNotification('Новое сообщение', 'IN2'))
    await waitFor(() => expect(server.deleted).toEqual([stateReceipt, messageReceipt]), { timeout: 3000 })

    const chatList = screen.getByRole('list', { name: 'Чаты' })
    expect(within(chatList).getByText('Иван Петров')).toBeInTheDocument()
    expect(within(chatList).getByText('1')).toBeInTheDocument()
  })

  it('показывает ошибку при неверных учётных данных', async () => {
    server.setAuthStatus(401)
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('idInstance'), '1101000001')
    await user.type(screen.getByLabelText('apiTokenInstance'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный idInstance или apiTokenInstance')
  })

  it('валидирует номер при создании чата', async () => {
    const user = userEvent.setup()
    render(<App />)
    await login(user)
    await user.type(screen.getByLabelText('Номер телефона получателя'), '123')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Введите номер в международном формате')
    expect(screen.queryByRole('list', { name: 'Чаты' })).not.toBeInTheDocument()
  })

  it('предлагает включить уведомления, если они выключены в настройках инстанса', async () => {
    server.setSettings({ webhookUrl: '', incomingWebhook: 'no', outgoingWebhook: 'no' })
    const user = userEvent.setup()
    render(<App />)
    await login(user)

    await user.click(await screen.findByRole('button', { name: 'Включить' }))
    expect(await screen.findByText(/Настройки инстанса сохранены/)).toBeInTheDocument()
    expect(server.settings).toMatchObject(REQUIRED_SETTINGS)
  })

  it('восстанавливает сессию и переписку после перезагрузки, выход сбрасывает вход', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await login(user)
    await user.type(screen.getByLabelText('Номер телефона получателя'), '79991234567')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))
    unmount()

    render(<App />)
    expect(await screen.findByText('Инстанс 1101000001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+7 999 123-45-67/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })
})
