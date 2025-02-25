/* eslint-env mocha */
'use strict'

const uint8ArrayFromString = require('uint8arrays/from-string')
const dagPB = require('@ipld/dag-pb')
const dagCBOR = require('@ipld/dag-cbor')
const { importer } = require('ipfs-unixfs-importer')
const { UnixFS } = require('ipfs-unixfs')
const all = require('it-all')
const { CID } = require('multiformats/cid')
const { sha256 } = require('multiformats/hashes/sha2')
const { base32 } = require('multiformats/bases/base32')
const { getDescribe, getIt, expect } = require('../utils/mocha')
const testTimeout = require('../utils/test-timeout')
const { identity } = require('multiformats/hashes/identity')
const dagCbor = require('@ipld/dag-cbor')
const blockstore = require('../utils/blockstore-adapter')

/**
 * @typedef {import('ipfsd-ctl').Factory} Factory
 */

/**
 * @param {Factory} factory
 * @param {Object} options
 */
module.exports = (factory, options) => {
  const describe = getDescribe(options)
  const it = getIt(options)

  describe('.dag.get', () => {
    /** @type {import('ipfs-core-types').IPFS} */
    let ipfs
    before(async () => { ipfs = (await factory.spawn()).api })

    after(() => factory.clean())

    /**
     * @type {dagPB.PBNode}
     */
    let pbNode
    /**
     * @type {any}
     */
    let cborNode
    /**
     * @type {dagPB.PBNode}
     */
    let nodePb
    /**
     * @type {any}
     */
    let nodeCbor
    /**
     * @type {CID}
     */
    let cidPb
    /**
     * @type {CID}
     */
    let cidCbor

    before(async () => {
      const someData = uint8ArrayFromString('some other data')
      pbNode = {
        Data: someData,
        Links: []
      }
      cborNode = {
        data: someData
      }

      nodePb = {
        Data: uint8ArrayFromString('I am inside a Protobuf'),
        Links: []
      }
      cidPb = CID.createV0(await sha256.digest(dagPB.encode(nodePb)))
      nodeCbor = {
        someData: 'I am inside a Cbor object',
        pb: cidPb
      }

      cidCbor = CID.createV1(dagCBOR.code, await sha256.digest(dagCBOR.encode(nodeCbor)))

      await ipfs.dag.put(nodePb, { format: 'dag-pb', hashAlg: 'sha2-256' })
      await ipfs.dag.put(nodeCbor, { format: 'dag-cbor', hashAlg: 'sha2-256' })
    })

    it('should respect timeout option when getting a DAG node', () => {
      return testTimeout(() => ipfs.dag.get(CID.parse('QmPv52ekjS75L4JmHpXVeuJ5uX2ecSfSZo88NSyxwA3rAd'), {
        timeout: 1
      }))
    })

    it('should get a dag-pb node', async () => {
      const cid = await ipfs.dag.put(pbNode, {
        format: 'dag-pb',
        hashAlg: 'sha2-256'
      })

      const result = await ipfs.dag.get(cid)

      const node = result.value
      expect(pbNode).to.eql(node)
    })

    it('should get a dag-cbor node', async () => {
      const cid = await ipfs.dag.put(cborNode, {
        format: 'dag-cbor',
        hashAlg: 'sha2-256'
      })

      const result = await ipfs.dag.get(cid)

      const node = result.value
      expect(cborNode).to.eql(node)
    })

    it('should get a dag-pb node with path', async () => {
      const result = await ipfs.dag.get(cidPb, {
        path: '/'
      })

      const node = result.value

      const cid = CID.createV0(await sha256.digest(dagPB.encode(node)))
      expect(cid.equals(cidPb)).to.be.true()
    })

    it('should get a dag-pb node local value', async function () {
      const result = await ipfs.dag.get(cidPb, {
        path: 'Data'
      })
      expect(result.value).to.eql(uint8ArrayFromString('I am inside a Protobuf'))
    })

    it.skip('should get a dag-pb node value one level deep', (done) => {})
    it.skip('should get a dag-pb node value two levels deep', (done) => {})

    it('should get a dag-cbor node with path', async () => {
      const result = await ipfs.dag.get(cidCbor, {
        path: '/'
      })

      const node = result.value

      const cid = CID.createV1(dagCBOR.code, await sha256.digest(dagCBOR.encode(node)))
      expect(cid.equals(cidCbor)).to.be.true()
    })

    it('should get a dag-cbor node local value', async () => {
      const result = await ipfs.dag.get(cidCbor, {
        path: 'someData'
      })
      expect(result.value).to.eql('I am inside a Cbor object')
    })

    it.skip('should get dag-cbor node value one level deep', (done) => {})
    it.skip('should get dag-cbor node value two levels deep', (done) => {})
    it.skip('should get dag-cbor value via dag-pb node', (done) => {})

    it('should get dag-pb value via dag-cbor node', async function () {
      const result = await ipfs.dag.get(cidCbor, {
        path: 'pb/Data'
      })
      expect(result.value).to.eql(uint8ArrayFromString('I am inside a Protobuf'))
    })

    it('should get by CID with path option', async function () {
      const result = await ipfs.dag.get(cidCbor, { path: '/pb/Data' })
      expect(result.value).to.eql(uint8ArrayFromString('I am inside a Protobuf'))
    })

    it('should get only a CID, due to resolving locally only', async function () {
      const result = await ipfs.dag.get(cidCbor, {
        path: 'pb/Data',
        localResolve: true
      })
      expect(result.value.equals(cidPb)).to.be.true()
    })

    it('should get with options and no path', async function () {
      const result = await ipfs.dag.get(cidCbor, { localResolve: true })
      expect(result.value).to.deep.equal(nodeCbor)
    })

    it('should get a node added as CIDv0 with a CIDv1', async () => {
      const input = uint8ArrayFromString(`TEST${Math.random()}`)

      const node = {
        Data: input,
        Links: []
      }

      const cid = await ipfs.dag.put(node, {
        format: 'dag-pb',
        hashAlg: 'sha2-256',
        version: 0
      })
      expect(cid.version).to.equal(0)

      const cidv1 = cid.toV1()

      const output = await ipfs.dag.get(cidv1)
      expect(output.value.Data).to.eql(input)
    })

    it('should get a node added as CIDv1 with a CIDv0', async () => {
      const input = uint8ArrayFromString(`TEST${Math.random()}`)

      const res = await all(importer([{ content: input }], blockstore(ipfs), {
        cidVersion: 1,
        rawLeaves: false
      }))

      const cidv1 = res[0].cid
      expect(cidv1.version).to.equal(1)

      const cidv0 = cidv1.toV0()

      const output = await ipfs.dag.get(cidv0)
      expect(UnixFS.unmarshal(output.value.Data).data).to.eql(input)
    })

    it('should be able to get part of a dag-cbor node', async () => {
      const cbor = {
        foo: 'dag-cbor-bar'
      }

      const cid = await ipfs.dag.put(cbor, { format: 'dag-cbor', hashAlg: 'sha2-256' })
      expect(cid.code).to.equal(dagCbor.code)
      expect(cid.toString(base32)).to.equal('bafyreic6f672hnponukaacmk2mmt7vs324zkagvu4hcww6yba6kby25zce')

      const result = await ipfs.dag.get(cid, {
        path: 'foo'
      })
      expect(result.value).to.equal('dag-cbor-bar')
    })

    it('should be able to traverse from one dag-cbor node to another', async () => {
      const cbor1 = {
        foo: 'dag-cbor-bar'
      }

      const cid1 = await ipfs.dag.put(cbor1, { format: 'dag-cbor', hashAlg: 'sha2-256' })
      const cbor2 = { other: cid1 }

      const cid2 = await ipfs.dag.put(cbor2, { format: 'dag-cbor', hashAlg: 'sha2-256' })

      const result = await ipfs.dag.get(cid2, {
        path: 'other/foo'
      })
      expect(result.value).to.equal('dag-cbor-bar')
    })

    it('should be able to get a DAG node with format raw', async () => {
      const buf = Uint8Array.from([0, 1, 2, 3])

      const cid = await ipfs.dag.put(buf, {
        format: 'raw',
        hashAlg: 'sha2-256'
      })

      const result = await ipfs.dag.get(cid)
      expect(result.value).to.deep.equal(buf)
    })

    it('should be able to get a dag-cbor node with the identity hash', async () => {
      const identityData = uint8ArrayFromString('A16461736466190144', 'base16upper')
      const identityHash = await identity.digest(identityData)
      const identityCID = CID.createV1(identity.code, identityHash)
      const result = await ipfs.dag.get(identityCID)
      expect(result.value).to.deep.equal(identityData)
    })

    it('should throw error for invalid string CID input', () => {
      // @ts-expect-error invalid arg
      return expect(ipfs.dag.get('INVALID CID'))
        .to.eventually.be.rejected()
    })

    it('should throw error for invalid buffer CID input', () => {
      // @ts-expect-error invalid arg
      return expect(ipfs.dag.get(uint8ArrayFromString('INVALID CID')))
        .to.eventually.be.rejected()
    })
  })
}
