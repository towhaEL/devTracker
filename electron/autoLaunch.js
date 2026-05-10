const { app } = require('electron')

function enable() {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    name: 'DevTracker',
  })
  console.log('[AutoLaunch] Enabled')
}

function disable() {
  app.setLoginItemSettings({ openAtLogin: false })
  console.log('[AutoLaunch] Disabled')
}

function isEnabled() {
  return app.getLoginItemSettings().openAtLogin
}

module.exports = { enable, disable, isEnabled }
