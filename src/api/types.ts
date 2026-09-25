export interface Credentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export interface StateInstanceResponse {
  stateInstance: 'authorized' | 'notAuthorized' | 'blocked' | 'starting' | 'yellowCard' | string
}

export interface InstanceSettings {
  wid?: string
  typeInstance?: string
  webhookUrl?: string
  incomingWebhook?: 'yes' | 'no'
  outgoingWebhook?: 'yes' | 'no'
  outgoingMessageWebhook?: 'yes' | 'no'
  outgoingAPIMessageWebhook?: 'yes' | 'no'
  [key: string]: unknown
}

export interface SendMessageResponse {
  idMessage: string
}

export interface SenderData {
  chatId: string
  chatName?: string
  chatType?: string
  sender?: string
  senderName?: string
  senderContactName?: string
  senderPhoneNumber?: number | string
}

export interface MessageData {
  typeMessage: string
  textMessageData?: { textMessage: string }
  extendedTextMessageData?: { text: string }
  [key: string]: unknown
}

export interface NotificationBody {
  typeWebhook: string
  instanceData?: { idInstance: number; wid: string; typeInstance: string }
  timestamp: number
  idMessage?: string
  senderData?: SenderData
  messageData?: MessageData
  // Поля уведомления outgoingMessageStatus
  chatId?: string
  status?: string
  [key: string]: unknown
}

export interface ReceivedNotification {
  receiptId: number
  body: NotificationBody
}
