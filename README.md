# Salon Demo

An independent, interactive demonstration of Simple Salon. It reuses the stylist calendar and the public booking layout, then runs both from fictional data stored in the visitor's browser.

No live API, Lambda, S3, Amazon SES, or Stripe account is used. Appointments, emails, and payments are simulated.

## Views

- **Stylist** — calendar, appointments, clients, booking, blocked time, reschedule requests, payment status, and settings.
- **Customer** — choose a fictional customer, book, confirm, cancel, request a reschedule, and approve a simulated payment with an optional tip.
- **Inbox** — confirmation, reminder, reschedule, cancellation, payment, receipt, and daily summary messages. Buttons open the matching demo flow.

**Reset Demo** restores the original fictional data for this browser only. Refreshing the page keeps the current visitor's changes.

## Scripts

```bash
npm install
npm test
npm run build
npm run dev
```
