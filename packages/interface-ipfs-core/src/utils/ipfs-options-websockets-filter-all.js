'use strict'

// @ts-ignore no types
const WS = require('libp2p-websockets')
// @ts-ignore no types
const filters = require('libp2p-websockets/src/filters')
const transportKey = WS.prototype[Symbol.toStringTag]

module.exports = () => ({
  libp2p: {
    config: {
      transport: {
        [transportKey]: {
          filter: filters.all
        }
      }
    }
  }
})
