'use strict'

const { expect } = require('./mocha')
const isShardAtPath = require('./is-shard-at-path')
const last = require('it-last')

/**
 * @param {import('ipfs-core-types').IPFS} ipfs
 * @param {number} [files]
 */
module.exports = async (ipfs, files = 1001) => {
  const dirPath = `/sharded-dir-${Math.random()}`

  const result = await last(ipfs.addAll((function * () {
    for (let i = 0; i < files; i++) {
      yield {
        path: `${dirPath}/file-${i}`,
        content: Uint8Array.from([0, 1, 2, 3, 4, 5, i])
      }
    }
  }()), {
    preload: false,
    pin: false
  }))

  if (!result) {
    throw new Error('No result received from ipfs.addAll')
  }

  await ipfs.files.cp(`/ipfs/${result.cid}`, dirPath)

  await expect(isShardAtPath(dirPath, ipfs)).to.eventually.be.true('Tried to create a shared directory but the result was not a shard')

  return dirPath
}
