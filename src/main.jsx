import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

function StartupFailure({ error }) {
  return (
    <main style={{minHeight:'100vh',background:'#070707',color:'#fff',display:'grid',placeItems:'center',padding:'24px',fontFamily:'system-ui,sans-serif'}}>
      <section style={{maxWidth:'420px',textAlign:'center'}}>
        <h1 style={{fontSize:'20px',marginBottom:'10px'}}>PasKey could not start</h1>
        <p style={{color:'#AEB4BE',lineHeight:1.5}}>Your vault data was not deleted. Close PasKey and open it again. If this screen remains, update the app.</p>
        {import.meta.env.DEV && <pre style={{whiteSpace:'pre-wrap',textAlign:'left'}}>{String(error?.stack || error || '')}</pre>}
      </section>
    </main>
  )
}

class StartupBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) {
    // Do not log vault data or exception payloads in production builds.
    if (import.meta.env.DEV) console.error('PasKey startup error', error)
  }
  render() {
    return this.state.error ? <StartupFailure error={this.state.error} /> : this.props.children
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('PasKey root element is missing')

ReactDOM.createRoot(root).render(
  <StartupBoundary>
    <App />
  </StartupBoundary>
)
