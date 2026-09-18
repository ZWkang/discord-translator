import { render } from 'solid-js/web';
import { browser } from 'wxt/browser';

import './style.css';
import App from './App';

render(() => <App />, document.getElementById('root')!);

void browser.tabs.getCurrent().then((tab) => {
  if (tab) document.documentElement.classList.add('dt-settings-tab');
}).catch((error) => console.error('[Discord Translator] cannot determine settings view', error));
