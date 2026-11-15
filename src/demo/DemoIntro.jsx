export default function DemoIntro({ title, subtitle, who, does, trigger, relief }) {
  return (
    <header className="demo-intro">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <dl>
        <div><dt>Who</dt><dd>{who}</dd></div>
        <div><dt>What</dt><dd>{does}</dd></div>
        <div><dt>When</dt><dd>{trigger}</dd></div>
        <div><dt>Less work</dt><dd>{relief}</dd></div>
      </dl>
    </header>
  )
}
