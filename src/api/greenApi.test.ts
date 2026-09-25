import { GreenApiClient, GreenApiError, defaultApiUrl } from './greenApi'

const credentials = {
  apiUrl: 'https://4100.api.green-api.com/',
  idInstance: '4100000001',
  apiTokenInstance: 'token123',
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function respond(body: string, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(body, { status }))
}

describe('defaultApiUrl', () => {
  it('определяет хост по первым 4 цифрам idInstance', () => {
    expect(defaultApiUrl('410022746551')).toBe('https://4100.api.green-api.com')
    expect(defaultApiUrl('1101000001')).toBe('https://1101.api.green-api.com')
    expect(defaultApiUrl('abc')).toBe('https://api.green-api.com')
  })
})

describe('GreenApiClient', () => {
  const client = new GreenApiClient(credentials)

  it('отправляет сообщение методом sendMessage', async () => {
    respond('{"idMessage":"M1"}')
    await expect(client.sendMessage('79991234567@c.us', 'Привет')).resolves.toEqual({ idMessage: 'M1' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://4100.api.green-api.com/waInstance4100000001/sendMessage/token123')
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(init!.body as string)).toEqual({ chatId: '79991234567@c.us', message: 'Привет' })
  })

  it('получает уведомление с receiveTimeout', async () => {
    respond('{"receiptId":7,"body":{"typeWebhook":"incomingMessageReceived","timestamp":1}}')
    await expect(client.receiveNotification(20)).resolves.toMatchObject({ receiptId: 7 })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://4100.api.green-api.com/waInstance4100000001/receiveNotification/token123?receiveTimeout=20',
    )
  })

  it('возвращает null при пустой очереди', async () => {
    respond('')
    await expect(client.receiveNotification(5)).resolves.toBeNull()
    respond('null')
    await expect(client.receiveNotification(5)).resolves.toBeNull()
  })

  it('запрашивает аватар методом getAvatar', async () => {
    respond('{"urlAvatar":"https://example.com/a.jpg"}')
    await expect(client.getAvatar('10000000')).resolves.toEqual({ urlAvatar: 'https://example.com/a.jpg' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://4100.api.green-api.com/waInstance4100000001/getAvatar/token123')
    expect(JSON.parse(init!.body as string)).toEqual({ chatId: '10000000' })
  })

  it('удаляет уведомление по receiptId', async () => {
    respond('{"result":true}')
    await client.deleteNotification(7)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://4100.api.green-api.com/waInstance4100000001/deleteNotification/token123/7')
    expect(init?.method).toBe('DELETE')
  })

  it.each([
    [401, '', 'Неверный idInstance или apiTokenInstance'],
    [429, '', 'Слишком много запросов, попробуйте позже'],
    [466, '', 'Превышен лимит тарифа GREEN-API'],
    [400, '{"message":"Validation failed. Details: \'chatId\' is required"}', "Ошибка GREEN-API (400): Validation failed. Details: 'chatId' is required"],
    [500, 'Internal error', 'Ошибка GREEN-API (500): Internal error'],
  ])('понятная ошибка для HTTP %i', async (status, body, message) => {
    respond(body, status)
    const error = await client.getStateInstance().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GreenApiError)
    expect(error).toMatchObject({ message, status })
  })

  it('сообщает об отсутствии соединения', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(client.getStateInstance()).rejects.toThrow('Нет соединения с GREEN-API')
  })

  it('требует тело ответа там, где оно обязательно', async () => {
    respond('')
    await expect(client.sendMessage('1', 'x')).rejects.toThrow('Пустой ответ GREEN-API')
  })
})
