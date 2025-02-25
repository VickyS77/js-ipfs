/* eslint-env mocha */
'use strict'

const { getDescribe, getIt } = require('../utils/mocha')
const { waitForWantlistKey } = require('./utils')
const { isWebWorker } = require('ipfs-utils/src/env')
const getIpfsOptions = require('../utils/ipfs-options-websockets-filter-all')
const { CID } = require('multiformats/cid')

/**
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

/**
 * @param {Factory} factory
 * @param {Object} options
 */
module.exports = (factory, options) => {
  const ipfsOptions = getIpfsOptions()
  const describe = getDescribe(options)
  const it = getIt(options)

  describe('.bitswap.wantlistForPeer', function () {
    this.timeout(60 * 1000)

    /** @type {import('ipfs-core-types').IPFS} */
    let ipfsA
    /** @type {import('ipfs-core-types').IPFS} */
    let ipfsB
    const key = 'QmUBdnXXPyoDFXj3Hj39dNJ5VkN3QFRskXxcGaYFBB8CNR'

    before(async () => {
      ipfsA = (await factory.spawn({ type: 'proc', ipfsOptions })).api
      // webworkers are not dialable because webrtc is not available
      ipfsB = (await factory.spawn({ type: isWebWorker ? 'go' : undefined })).api
      // Add key to the wantlist for ipfsB
      ipfsB.block.get(CID.parse(key)).catch(() => { /* is ok, expected on teardown */ })

      const ipfsBId = await ipfsB.id()

      await ipfsA.swarm.connect(ipfsBId.addresses[0])
    })

    after(() => factory.clean())

    it('should get the wantlist by peer ID for a different node', async () => {
      const ipfsBId = await ipfsB.id()

      return waitForWantlistKey(ipfsA, key, {
        peerId: ipfsBId.id,
        timeout: 60 * 1000
      })
    })
  })
}
