import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installNetworkGuard } from './demo/networkGuard.js'
import './index.css'
import App from './App.jsx'

installNetworkGuard()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
