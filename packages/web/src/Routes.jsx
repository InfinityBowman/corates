import { Router, Route } from '@solidjs/router'
import App from './App.jsx'

export const BASEPATH = import.meta.env.VITE_BASEPATH || '/'

export default function AppRoutes() {
  return (
    <Router base={BASEPATH}>
      <Route path='/' component={App}></Route>
    </Router>
  )
}
