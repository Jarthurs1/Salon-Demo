export default function DemoIntro({ title, subtitle }) {
  return (
    <header className="demo-intro">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  )
}
