import { useState } from 'react'

interface AvatarProps {
  title: string
  url: string | null | undefined
}

function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (/^\d/.test(words[0])) return words.join('').slice(-2)
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}

export function Avatar({ title, url }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (url && url !== failedUrl) {
    return <img className="avatar" src={url} alt="" onError={() => setFailedUrl(url)} />
  }
  return (
    <span className="avatar" aria-hidden>
      {initials(title)}
    </span>
  )
}
