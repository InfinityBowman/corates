import { render } from 'solid-js/web';
import './global.css';
import Routes from './Routes.jsx';

function Root() {
  return <Routes />;
}

render(() => <Root />, document.getElementById('root'));
