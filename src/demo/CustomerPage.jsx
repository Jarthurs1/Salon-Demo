import { useSearchParams } from 'react-router-dom'
import CustomerDemo from '../customer/CustomerDemo.jsx'
import CardSetup from './CardSetup.jsx'
import DemoIntro from './DemoIntro.jsx'
import { CUSTOMER_STEPS } from './sections.js'

const TRY_IT = {
  book: 'Choose a service and time to book Emily’s appointment.',
  manage: 'Confirm, cancel, or request a different appointment time.',
  card: 'Save Emily’s fictional payment method.',
  pay: 'Add a tip and approve the payment.',
}

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
        subtitle="Book, change a time, and pay from the phone."
      />
      <div className="demo-steps" role="tablist" aria-label="Customer steps">
        {CUSTOMER_STEPS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={step === id} className={step === id ? 'is-active' : ''} onClick={() => choose(id)}>
            {label}
          </button>
        ))}
      </div>
      <p className="try-it"><strong>Try it:</strong> {TRY_IT[step]}</p>
      {step === 'card' ? <CardSetup /> : <CustomerDemo key={step} step={step} />}
    </section>
  )
}
