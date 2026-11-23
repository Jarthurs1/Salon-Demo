import { useSearchParams } from 'react-router-dom'
import CustomerDemo from '../customer/CustomerDemo.jsx'
import CardSetup from './CardSetup.jsx'
import DemoIntro from './DemoIntro.jsx'
import { CUSTOMER_STEPS } from './sections.js'

export default function CustomerPage() {
  const [params, setParams] = useSearchParams()
  const step = CUSTOMER_STEPS.some(([id]) => id === params.get('step')) ? params.get('step') : 'book'

  function choose(next) {
    setParams({ step: next })
  }

  return (
    <section className="demo-page">
      <DemoIntro
        title="Customer Experience"
        subtitle="Book, confirm, and pay without calling the salon."
      />
      <p className="demo-page__support">Emily Carter is the example customer. What she does here shows up on Mara’s calendar.</p>
      <div className="demo-steps" role="tablist" aria-label="Customer steps">
        {CUSTOMER_STEPS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={step === id} className={step === id ? 'is-active' : ''} onClick={() => choose(id)}>
            {label}
          </button>
        ))}
      </div>
      {step === 'card' ? <CardSetup /> : <CustomerDemo key={step} step={step} />}
    </section>
  )
}
