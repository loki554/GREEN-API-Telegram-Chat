import { useState } from 'react'
import type { Credentials } from './api/types'
import { ChatScreen } from './components/ChatScreen'
import { LoginScreen } from './components/LoginScreen'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/storage'

export function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials)

  if (!credentials) {
    return (
      <LoginScreen
        onLogin={(value) => {
          saveCredentials(value)
          setCredentials(value)
        }}
      />
    )
  }

  return (
    <ChatScreen
      key={credentials.idInstance}
      credentials={credentials}
      onLogout={() => {
        clearCredentials()
        setCredentials(null)
      }}
    />
  )
}
