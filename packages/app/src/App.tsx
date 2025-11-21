import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import Home from './pages/Home';

const About = lazy(() => import('./pages/About'));

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
    </Router>
  );
}

export default App;
