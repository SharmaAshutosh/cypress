const _ = require('lodash')
const CRI = require('chrome-remote-interface')
const promiseRetry = require('promise-retry')
const Promise = require('bluebird')
const net = require('net')
const la = require('lazy-ass')
const is = require('check-more-types')
const pluralize = require('pluralize')
const debug = require('debug')('cypress:server:protocol')

function connectAsync (opts) {
  return new Promise(function (resolve, reject) {
    debug('connectAsync with options %o', opts)
    let socket = net.connect(opts)

    socket.once('connect', function () {
      socket.removeListener('error', reject)
      debug('successfully connected with options %o', opts)
      resolve(socket)
    })

    socket.once('error', function (err) {
      debug('error connecting with options %o', opts, err)
      socket.removeListener('connection', resolve)
      reject(err)
    })
  })
}

/**
 * Waits for the port to respond with connection to Chrome Remote Interface
 * @param {number} port Port number to connect to
 */
const getWsTargetFor = (port) => {
  debug('Getting WS connection to CRI on port %d', port)
  la(is.port(port), 'expected port number', port)

  return promiseRetry(
    (retry) => {
      return connectAsync({ port }).catch(retry)
    },
    { retries: 10 }
  )
  .catch(() => {
    debug('retry connecting to debugging port %d', port)
  })
  .then(() => {
    debug('CRI.List on port %d', port)

    // what happens if the next call throws an error?
    // it seems to leave the browser instance open
    return CRI.List({ port })
  })
  .then((targets) => {
    debug(
      'CRI list has %s %o',
      pluralize('targets', targets.length, true),
      targets
    )
    // activate the first available id

    // find the first target page that's a real tab
    // and not the dev tools or background page.
    // typically there are two targets found like
    // { title: 'Cypress', type: 'background_page', url: 'chrome-extension://...', ... }
    // { title: 'New Tab', type: 'page', url: 'chrome://newtab/', ...}
    // const newTabTargetFields = { type: 'page', url: 'chrome://newtab/' }
    const newTabTargetFields = { type: 'page', title: 'Electron' }
    const target = _.find(targets, newTabTargetFields)

    la(target, 'could not find CRI target')
    debug('found CRI target %o', target)

    return target.webSocketDebuggerUrl
  })
}

module.exports = {
  getWsTargetFor,
}