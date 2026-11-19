import 'virtual:uno.css'
import '@just-apps/app-kit/styles.css'
import { AppFrame, createApp } from '@just-apps/app-kit'
import { version } from '../package.json'
import { mockCommands } from './native/mock'
import Settings from './settings'
import StandardsWindow from './window'

// The main window draws its own frame for the cell's side pane; the settings window keeps the platform's.
const SettingsWindow = () => <AppFrame routes={{}} settings={Settings} />

createApp({
  name: 'Standards',
  version,
  routes: { '/': StandardsWindow, '/settings': SettingsWindow },
  commands: mockCommands,
  frame: false,
})
