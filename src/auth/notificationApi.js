import { recordDemoMail } from '../demo/mailbox.js'

export async function sendTestNotificationEmail() {
  recordDemoMail('test', {
    clientName: 'Mara',
    service: 'Test notification',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
  })
  return { ok: true, message: 'A simulated test email is in the Demo Inbox.' }
}
