import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './report.css'
import ReportPage from './report-page.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ReportPage />
  </StrictMode>,
)
