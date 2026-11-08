import { useEffect, useState } from 'react'
import {
  disableSharePush,
  enableSharePush,
  readSharePushState,
  sendTestNotification,
  shareLink,
  type SharePushState,
} from '../lib/sharePush'

const BUTTON = 'cc-btn-secondary flex-1 h-9 rounded-[5px] text-sm font-semibold whitespace-nowrap'

// Settings section for sending games from the chess.com share sheet into the Home Screen app.
// Setup steps for the Shortcut itself: docs/iphone.md.
export function SharePushSetup() {
  const [state, setState] = useState<SharePushState | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    readSharePushState().then(next => { if (current) setState(next) })
    return () => { current = false }
  }, [])

  const handleEnable = async () => {
    setMessage('Turning on…')
    const result = await enableSharePush()
    if (result.ok) {
      setState('on')
      setMessage('Notifications are on. Now copy the link into your Shortcut.')
    } else if (result.reason === 'denied') {
      setMessage('Notifications are blocked. Allow them in iOS Settings → Notifications → Game Review.')
    } else {
      setMessage('Could not turn on notifications. Try again.')
    }
  }

  const handleCopy = async () => {
    const link = shareLink()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setMessage('Copied. Keep this link private: it can send notifications to this phone.')
    } catch {
      setMessage('Could not copy the link.')
    }
  }

  const handleTest = async () => {
    setMessage('Sending…')
    const result = await sendTestNotification()
    if (result === 'sent') setMessage('Sent. A notification should appear in a few seconds.')
    else if (result === 'expired') setMessage('This setup has expired. Turn it off and on again, then update your Shortcut.')
    else setMessage('Could not send the notification.')
  }

  const handleDisable = async () => {
    await disableSharePush()
    setState('off')
    setMessage(null)
  }

  if (state === null) return null

  return (
    <section className="space-y-2 pt-2 border-t border-cc-border/60">
      <div className="px-1">
        <h3 className="text-sm text-cc-text">Share from chess.com</h3>
        <p className="text-xs text-cc-text-dim">
          Open a game from the chess.com share sheet in this app, with one tap on a notification.
        </p>
      </div>
      {state === 'unsupported' && (
        <p className="px-1 text-xs text-cc-text-dim">Not available in this browser.</p>
      )}
      {state === 'needs-install' && (
        <p className="px-1 text-xs text-cc-text-dim">
          Add Game Review to your Home Screen first (Share → Add to Home Screen), then open it from there.
        </p>
      )}
      {state === 'off' && (
        <div className="flex gap-2">
          <button className={BUTTON} onClick={handleEnable}>Enable notifications</button>
        </div>
      )}
      {state === 'on' && (
        <>
          <div className="flex gap-2">
            <button className={BUTTON} onClick={handleCopy}>Copy Shortcut link</button>
            <button className={BUTTON} onClick={handleTest}>Test</button>
          </div>
          <div className="flex gap-2">
            <button className={BUTTON} onClick={handleDisable}>Turn off</button>
          </div>
        </>
      )}
      {message && <p className="px-1 text-xs text-cc-text-dim">{message}</p>}
    </section>
  )
}
