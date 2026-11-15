import { MessageSquare, Phone } from 'lucide-react'
import { buildSmsUrl, buildTelUrl } from '../utils/clientUtils.js'
import './ContactQuickActions.css'

/**
 * Native iOS Message / Call shortcuts via sms: and tel: links.
 * Hidden when no usable phone number is on file (or when both actions are disabled).
 */
export default function ContactQuickActions({
  phone,
  showMessage = true,
  showCall = true,
  messageBody = '',
  messageClassName = '',
  callClassName = '',
  className = '',
}) {
  const smsHref = showMessage ? buildSmsUrl(phone, { body: messageBody }) : null
  const telHref = showCall ? buildTelUrl(phone) : null

  if (!smsHref && !telHref) return null

  return (
    <div className={`contact-quick-actions ${className}`.trim()}>
      {smsHref ? (
        <a
          className={`contact-quick-actions__message ${messageClassName}`.trim()}
          href={smsHref}
        >
          <MessageSquare size={18} strokeWidth={2.25} aria-hidden="true" />
          Message
        </a>
      ) : null}
      {telHref ? (
        <a
          className={`contact-quick-actions__call ${callClassName}`.trim()}
          href={telHref}
        >
          <Phone size={16} strokeWidth={2.25} aria-hidden="true" />
          Call
        </a>
      ) : null}
    </div>
  )
}
