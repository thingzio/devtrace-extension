// Custom Jest environment: jsdom plus the web platform globals that jsdom
// omits but Node provides natively (fetch, Response, Headers, Request).
// These constructors are captured here from the Node realm — where this
// module is evaluated — and copied into the jsdom global so tests can spy on
// global.fetch and construct Response objects. The jsdom AbortSignal lacks the
// static timeout() method, so Node's AbortSignal/AbortController are injected
// as well.
const JSDOMEnvironment = require('jest-environment-jsdom').default

const nodeGlobals = {
  fetch,
  Response,
  Headers,
  Request,
  AbortController,
  AbortSignal,
}

class JSDOMWithFetch extends JSDOMEnvironment {
  async setup() {
    await super.setup()
    for (const [name, value] of Object.entries(nodeGlobals)) {
      this.global[name] = value
    }
  }
}

module.exports = JSDOMWithFetch
