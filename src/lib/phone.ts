export function normalizePhone(input: string): string | null {
  if (/[^\d\s()+\-.]/.test(input)) return null
  let digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export function phoneToChatId(phone: string): string {
  return `${phone}@c.us`
}

export function phoneFromChatId(chatId: string): string | null {
  const match = /^(\d{10,15})@c\.us$/.exec(chatId)
  return match ? match[1] : null
}

export function formatPhone(phone: string): string {
  const m = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  if (m) return `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}`
  return `+${phone}`
}
