export default function DemoIntro({ title, subtitle, compact = false }) {
  return (
    <header className={compact ? 'demo-intro demo-intro--compact' : 'demo-intro'}>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  )
}
