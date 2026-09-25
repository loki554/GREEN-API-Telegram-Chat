import { formatPhone, normalizePhone, phoneFromChatId, phoneToChatId } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['79991234567', '79991234567'],
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['+380 44 123 4567', '380441234567'],
    ['1234567890', '1234567890'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['', '12345', '1234567890123456', '7999abc4567', 'user@example.com'])('отклоняет «%s»', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('chatId', () => {
  it('строит chatId из номера и извлекает номер обратно', () => {
    expect(phoneToChatId('79991234567')).toBe('79991234567@c.us')
    expect(phoneFromChatId('79991234567@c.us')).toBe('79991234567')
  })

  it('не считает Telegram ID и группы номером телефона', () => {
    expect(phoneFromChatId('10000000')).toBeNull()
    expect(phoneFromChatId('-10000000000000')).toBeNull()
  })
})

describe('formatPhone', () => {
  it('форматирует российские номера и оставляет остальные как есть', () => {
    expect(formatPhone('79991234567')).toBe('+7 999 123-45-67')
    expect(formatPhone('380441234567')).toBe('+380441234567')
  })
})
