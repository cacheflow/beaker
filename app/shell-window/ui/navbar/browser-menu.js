/* globals beaker DatArchive */

import os from 'os'
import * as yo from 'yo-yo'
import {ipcRenderer} from 'electron'
import { showInpageFind } from '../navbar'
import { findParent } from '../../../lib/fg/event-handlers'
import * as pages from '../../pages'

// there can be many drop menu btns rendered at once, but they are all showing the same information
// the BrowserMenuNavbarBtn manages all instances, and you should only create one

export class BrowserMenuNavbarBtn {
  constructor () {
    const isDarwin = os.platform() === 'darwin'
    const cmdOrCtrlChar = isDarwin ? '⌘' : '^'
    this.accelerators = {
      newWindow: cmdOrCtrlChar + 'N',
      newTab: cmdOrCtrlChar + 'T',
      findInPage: cmdOrCtrlChar + 'F',
      history: cmdOrCtrlChar + 'Y',
      openFile: cmdOrCtrlChar + 'O'
    }

    this.submenu
    this.downloads = []
    this.sumProgress = null // null means no active downloads
    this.isDropdownOpen = false
    this.shouldPersistDownloadsIndicator = false

    // fetch current downloads
    beaker.downloads.getDownloads().then(ds => {
      this.downloads = ds
      this.updateActives()
    })

    beaker.browser.getInfo().then(info => {
      this.browserInfo = info
      this.updateActives()
    })

    // wire up events
    var dlEvents = beaker.downloads.createEventsStream()
    dlEvents.addEventListener('new-download', this.onNewDownload.bind(this))
    dlEvents.addEventListener('sum-progress', this.onSumProgress.bind(this))
    dlEvents.addEventListener('updated', this.onUpdate.bind(this))
    dlEvents.addEventListener('done', this.onDone.bind(this))
    window.addEventListener('mousedown', this.onClickAnywhere.bind(this), true)
  }

  render () {
    // show active, then inactive, with a limit of 5 items
    var progressingDownloads = this.downloads.filter(d => d.state == 'progressing').reverse()

    // render the progress bar if downloading anything
    var progressEl = ''
    if (progressingDownloads.length > 0 && this.sumProgress && this.sumProgress.receivedBytes <= this.sumProgress.totalBytes) {
      progressEl = yo`<progress value=${this.sumProgress.receivedBytes} max=${this.sumProgress.totalBytes}></progress>`
    }

    // auto-updater
    var autoUpdaterEl = ''
    if (this.browserInfo && this.browserInfo.updater.isBrowserUpdatesSupported && this.browserInfo.updater.state === 'downloaded') {
      autoUpdaterEl = yo`
        <div class="section auto-updater">
          <div class="menu-item auto-updater" onclick=${e => this.onClickRestart()}>
            <i class="fa fa-arrow-circle-up"></i>
            <span class="label">Restart to update Beaker</span>
          </div>
        </div>
      `
    }

    // render the dropdown if open
    var dropdownEl = ''
    if (this.isDropdownOpen && this.submenu === 'create-new') {
      dropdownEl = yo`
        <div class="toolbar-dropdown dropdown toolbar-dropdown-menu-dropdown">
          <div class="dropdown-items submenu with-triangle">
            <div class="header">
              <button class="btn transparent" onclick=${e => this.onShowSubmenu('')} title="Go back">
                <i class="fa fa-angle-left"></i>
              </button>
              <h2>Create New</h2>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onCreateSite(e, )}>
                <i class="fa fa-sitemap"></i>
                <span class="label">Website</span>
              </div>

              <div class="menu-item" onclick=${e => this.onCreateSite(e, 'app')}>
                <i class="fa fa-puzzle-piece"></i>
                <span class="label">App</span>
              </div>
            </div>

            <div class="section">
              <div class="menu-item">
                <i class="fa fa-upload"></i>
                <span class="label">Import Files</span>
              </div>
            </div>
          </div>
        </div>`

    } else if (this.isDropdownOpen) {
      dropdownEl = yo`
        <div class="toolbar-dropdown dropdown toolbar-dropdown-menu-dropdown">
          <div class="dropdown-items with-triangle">
            ${autoUpdaterEl}

            <div class="section">
              <div class="menu-item" onclick=${e => this.onOpenNewWindow()}>
                <i class="fa fa-window-maximize"></i>
                <span class="label">New Window</span>
                <span class="shortcut">${this.accelerators.newWindow}</span>
              </div>

              <div class="menu-item" onclick=${e => this.onOpenNewTab()}>
                <i class="fa fa-file-o"></i>
                <span class="label">New Tab</span>
                <span class="shortcut">${this.accelerators.newTab}</span>
              </div>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onFindInPage(e)}>
                <i class="fa fa-search"></i>
                <span class="label">Find in Page</span>
                <span class="shortcut">${this.accelerators.findInPage}</span>
              </div>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onShowSubmenu('create-new')}>
                <i class="fa fa-plus-square-o"></i>
                <span class="label">Create New</span>
                <i class="more fa fa-angle-right"></i>
              </div>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'beaker://bookmarks')}>
                <i class="fa fa-star-o"></i>
                <span class="label">Bookmarks</span>
              </div>

              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'beaker://history')}>
                <i class="fa fa-history"></i>
                <span class="label">History</span>
                <span class="shortcut">${this.accelerators.history}</span>
              </div>

              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'beaker://library')}>
                <i class="fa fa-code"></i>
                <span class="label">Beaker Filesystem</span>
              </div>

              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'beaker://network')}>
                <i class="fa fa-signal"></i>
                <span class="label">Network Activity</span>
              </div>

              <div class="menu-item downloads" style=${progressEl ? 'height: 41px' : ''} onclick=${e => this.onClickDownloads(e)}>
                <i class="fa fa-download"></i>
                <span class="label">Downloads</span>
                ${this.shouldPersistDownloadsIndicator ? yo`<i class="fa fa-circle"></i>` : ''}
                ${progressEl}
              </div>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'beaker://settings')}>
                <i class="fa fa-gear"></i>
                <span class="label">Settings</span>
              </div>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onOpenFile()}>
                <i></i>
                <span class="label">Open File...</span>
                <span class="shortcut">${this.accelerators.openFile}</span>
              </div>
            </div>

            <div class="section">
              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'dat://beakerbrowser.com/docs/')}>
                <i class="fa fa-question-circle-o"></i>
                <span class="label">Help</span>
              </div>

              <div class="menu-item" onclick=${e => this.onOpenPage(e, 'https://github.com/beakerbrowser/beaker/issues')}>
                <i class="fa fa-flag-o"></i>
                <span class="label">Report an Issue</span>
              </div>
            </div>
          </div>
        </div>`
    }

    // render btn
    return yo`
      <div class="toolbar-dropdown-menu browser-dropdown-menu">
        <button class="toolbar-btn toolbar-dropdown-menu-btn ${this.isDropdownOpen ? 'pressed' : ''}" onclick=${e => this.onClickBtn(e)} title="Menu">
          <span class="fa fa-bars"></span>
        </button>
        ${dropdownEl}
      </div>`
  }

  updateActives () {
    Array.from(document.querySelectorAll('.browser-dropdown-menu')).forEach(el => yo.update(el, this.render()))
  }

  doAnimation () {
    Array.from(document.querySelectorAll('.browser-dropdown-menu .toolbar-btn')).forEach(el =>
      el.animate([
        {transform: 'scale(1.0)', color: 'inherit'},
        {transform: 'scale(1.5)', color: '#06c'},
        {transform: 'scale(1.0)', color: 'inherit'}
      ], { duration: 300 })
    )
  }

  onShowSubmenu(submenu) {
    this.submenu = submenu
    this.updateActives()
  }

  onOpenNewWindow () {
    ipcRenderer.send('new-window')
  }

  onOpenNewTab () {
    pages.setActive(pages.create('beaker://start'))
  }

  async onOpenFile () {
    var files = await beaker.browser.showOpenDialog({
       title: 'Open file...',
       properties: ['openFile', 'createDirectory']
    })
    if (files && files[0]) {
      pages.setActive(pages.create('file://' + files[0]))
    }
  }

  onClickBtn (e) {
    this.isDropdownOpen = !this.isDropdownOpen
    this.submenu = ''
    this.updateActives()
  }

  onClickAnywhere (e) {
    var parent = findParent(e.target, 'browser-dropdown-menu')
    if (parent) return // abort - this was a click on us!
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false
      this.submenu = ''
      this.updateActives()
    }
  }

  onClickDownloads (e) {
    this.shouldPersistDownloadsIndicator = false
    this.onOpenPage(e, 'beaker://downloads')
  }

  onNewDownload () {
    this.doAnimation()

    // open the dropdown
    this.isDropdownOpen = true
    this.updateActives()
  }

  onSumProgress (sumProgress) {
    this.sumProgress = sumProgress
    this.updateActives()
  }

  onUpdate (download) {
    // patch data each time we get an update
    var target = this.downloads.find(d => d.id == download.id)
    if (target) {
      // patch item
      for (var k in download) { target[k] = download[k] }
    } else { this.downloads.push(download) }
    this.updateActives()
  }

  onDone (download) {
    this.shouldPersistDownloadsIndicator = true
    this.doAnimation()
    this.onUpdate(download)
  }

  onFindInPage (e) {
    e.preventDefault()
    e.stopPropagation()

    // close dropdown
    this.isDropdownOpen = false

    showInpageFind(pages.getActive())
  }

  onClearDownloads (e) {
    e.preventDefault()
    e.stopPropagation()
    this.downloads = []
    this.updateActives()
  }

  async onCreateSite (e, type) {
    // close dropdown
    this.isDropdownOpen = !this.isDropdownOpen
    this.submenu = ''
    this.updateActives()

    // create a new workspace
    var wsInfo = await beaker.workspaces.create(0) // TODO: type
    pages.setActive(pages.create('beaker://workspaces/' + wsInfo.name))
  }

  onOpenPage (e, url) {
    pages.setActive(pages.create(url))
    this.isDropdownOpen = false
    this.updateActives()
  }

  onClickRestart () {
    beaker.browser.restartBrowser()
  }
}
