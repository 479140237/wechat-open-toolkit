const EventEmitter = require('events')
const error = require('./error')
const util = require('./util')
const Component = require('./component')

const ComponentList = function (options) {
  EventEmitter.call(this)
  const iteration = function (item) {
    item.getComponentVerifyTicket = options.getComponentVerifyTicket
    const component = new Component(item)
    component
      .on('component_verify_ticket', this.emit.bind(this, 'component_verify_ticket'))
      .on('component_access_token', this.emit.bind(this, 'component_access_token'))
      .on('authorized', this.emit.bind(this, 'authorized'))
      .on('updateauthorized', this.emit.bind(this, 'updateauthorized'))
      .on('unauthorized', this.emit.bind(this, 'unauthorized'))
      .on('error', this.emit.bind(this, 'error'))
      .on('authorizer_token', this.emit.bind(this, 'authorizer_token'))
    return component
  }
  this.components = options.list.map(iteration.bind(this))
  if (typeof options.onError === 'function') {
    this.on('error', options.onError)
  }
  if (typeof options.saveComponentVerifyTicket === 'function') {
    this.on('component_verify_ticket', options.saveComponentVerifyTicket)
  }
  if (typeof options.saveComponentAccessToken === 'function') {
    this.on('component_access_token', options.saveComponentAccessToken)
  }
  if (typeof options.onAuthorized === 'function') {
    this.on('authorized', options.onAuthorized)
    this.on('updateauthorized', options.onAuthorized)
  }
  if (typeof options.saveAuthorizerToken === 'function') {
    this.on('authorizer_token', options.saveAuthorizerToken)
  }
  // if (typeof options.getAuthorizers === 'function') {
  //   const getAuthorizersCallback = function (err, list) {
  //     if (err) {
  //       return this.emit('error', err)
  //     }
  //     this.addAuthorizers(list)
  //   }
  //   options.getAuthorizers(getAuthorizersCallback.bind(this))
  // }
}

ComponentList.prototype = Object.create(EventEmitter.prototype)

const proto = {}
proto.getComponent = function (componentAppId) {
  for (let i = 0, len = this.components.length; i < len; i++) {
    if (this.components[i].componentAppId === componentAppId) {
      return this.components[i]
    }
  }
  throw new error.WechatOpenToolkitError('componentId error')
}
proto.middlewarify = function () {
  const parseXmlCallback = function (req, res, next, err, result) {
    if (err) {
      return this.emit('error', err)
    }
    if (!(result && typeof result === 'object')) {
      res.writeHead(400, {
        'content-type': 'application/json'
      })
      return res.end(JSON.stringify({
        errmsg: 'The data is incorrect'
      }))
    }
    if (result.Encrypt) {
      return util.parseXml(
        this.getComponent(result.AppId).encrypt.decode(result.Encrypt), parseXmlCallback.bind(this, req, res, next)
      )
    }
    const infoType = result.InfoType
    result.componentAppId = result.AppId
    req.wechatOpenMessage = result
    this.getComponent(result.AppId).middlewarify()(req, res)
    if (typeof next === 'function') {
      next()
    }
  }
  const onEnd = function (buffers, req, res, next) {
    res.end('success')
    const xml = Buffer.concat(buffers).toString()
    util.parseXml(xml, parseXmlCallback.bind(this, req, res, next))
  }
  const middleware = function (req, res, next) {
    if (req.method.toLowerCase() !== 'post') {
      res.writeHead(403, {
        'content-type': 'text/html'
      })
      return res.end('<h1>The route is used to receive WeChat open platform authorization events, do not visit!</h1>')
    }
    const buffers = []
    req.on('data', buffers.push.bind(buffers)).on('end', onEnd.bind(this, buffers, req, res, next))
  }
  return middleware.bind(this)
}
proto.authMiddlewarify = function (componentAppId) {
  return this.getComponent(componentAppId).authorizationMiddlewarify()
}
proto.addAuthorizers = function (list) {
  list = list || []
  if (!(list && list instanceof Array)) {
    return this.emit('error', new error.WechatOpenToolkitError('argument must be an array'))
  }
  const iteration = function (item) {
    const componentAppId = item.componentAppId
    this.getComponent(componentAppId).addAuthorizer(item)
  }
  list.forEach(iteration.bind(this))
}

Object.assign(ComponentList.prototype, proto)

module.exports = ComponentList