const EventEmitter = require('events')
const fs = require('fs')
const querystring = require('querystring')
const urlParser = require('url')
const Encrypt = require('wechat-encrypt')
const util = require('./util')
const error = require('./error')
const Authorizer = require('./authorizer')

const Component = function (options) {
  if (!(this instanceof Component)) {
    return new Component(options)
  }
  EventEmitter.call(this)
  this.componentAppId = options.componentAppId
  this.componentAppSecret = options.componentAppSecret
  this.authorizer = []
  this.host = options.host
  this.encrypt = new Encrypt({
    appId: this.componentAppId,
    encodingAESKey: options.encodingAESKey,
    token: options.token
  })
  this.on('component_verify_ticket', this.onComponentVerifyTicket.bind(this))
  this.on('authorized', this.onAuthorized.bind(this))
  this.on('unauthorized', this.onUnauthorized.bind(this))
  this.once('component_access_token', this.onComponentAccessToken.bind(this))
  const getComponentVerifyTicketCallback = function (err, componentVerifyTicket) {
    if (err) {
      return this.emit('error', err)
    }
    if (!componentVerifyTicket) {
      return this.once('component_verify_ticket', this.start.bind(this))
    }
    this.componentVerifyTicket = componentVerifyTicket
    this.start()
  }
  options.getComponentVerifyTicket(this.componentAppId, getComponentVerifyTicketCallback.bind(this))

}

Component.prototype = Object.create(EventEmitter.prototype)

const proto = {}
proto.middlewarify = function () {
  const middleware = function (req, res, next) {
    const msg = req.wechatOpenMessage
    const infoType = msg.InfoType
    switch (infoType) {
      case 'component_verify_ticket':
        this.emit('component_verify_ticket', {
          componentAppId: msg.AppId,
          componentVerifyTicket: msg.ComponentVerifyTicket,
          infoType: infoType,
          createTime: parseInt(msg.CreateTime)
        })
        break
      case 'authorized':
        this.emit('authorized', {
          componentAppId: msg.AppId,
          infoType: infoType,
          createTime: parseInt(msg.CreateTime),
          authorizerAppId: msg.AuthorizerAppid,
          authorizationCode: msg.AuthorizationCode,
          authorizationCodeExpiredTime: parseInt(msg.AuthorizationCodeExpiredTime),
          preAuthCode: msg.PreAuthCode
        })
        break
      case 'updateauthorized':
        this.emit('update_authorized', {
          componentAppId: msg.AppId,
          authorizerAppId: msg.AuthorizerAppid,
          authorizationCode: msg.AuthorizationCode,
          authorizationCodeExpiredTime: parseInt(msg.AuthorizationCodeExpiredTime),
          preAuthCode: msg.PreAuthCode,
          infoType: infoType,
          createTime: parseInt(msg.CreateTime)
        })
        break
      case 'unauthorized':
        this.emit('unauthorized', {
          componentAppId: msg.AppId,
          authorizerAppId: msg.AuthorizerAppid,
          infoType: infoType,
          createTime: parseInt(msg.CreateTime)
        })
    }
    res.end('success')
    if (typeof next === 'function') {
      next()
    }
  }
  return middleware.bind(this)
}
proto.messageMiddlewarify = function () {
  const sendTextCallback = function (err) {
    if (err) {
      this.emit('error', err)
    }
  }
  const middleware = function (req, res, next) {
    const authTest = 'gh_3c884a361561'
    const authTestAppId = 'wx570bc396a51b8ff8'
    const msg = req.wechatOpenMessage
    if (msg.ToUserName !== authTest) {
      res.end('success')
      return next()
    }
    const reply = {
      ToUserName: msg.FromUserName,
      FromUserName: msg.ToUserName,
    }
    if (msg.MsgType === 'event') {
      reply.Content = msg.Event + 'from_callback'
      const xml = this.getReplyXml(reply)
      res.end(xml)
    } else if (msg.MsgType === 'text') {
      if (msg.Content === 'TESTCOMPONENT_MSG_TYPE_TEXT') {
        reply.Content = msg.Content + '_callback'
        const xml = this.getReplyXml(reply)
        res.end(xml)
      } else if (msg.Content.indexOf('QUERY_AUTH_CODE:') >= 0) {
        res.end('')
        const authorizationCode = msg.Content.slice(16)
        const authorizer = new Authorizer({
          authorizerAppId: authTestAppId,
          authorizationCode: authorizationCode,
          component: this
        })
        authorizer.sendText(msg.FromUserName, authorizationCode + '_from_api', sendTextCallback.bind(this))
      }
    }
  }
  return middleware.bind(this)
}
proto.getReplyXml = function (options) {
  let obj = {
    ToUserName: options.ToUserName,
    FromUserName: options.FromUserName,
    Content: options.Content,
    CreateTime: Date.now(),
    MsgType: 'text'
  }
  let xml = util.buildObject(obj)
  let encodeStr = this.encrypt.encode(xml)
  obj = {
    Encrypt: encodeStr,
    TimeStamp: Date.now(),
    Nonce: Math.random().toString(36).slice(2, 18)
  }
  obj.MsgSignature = this.encrypt.getSignature({
    timestamp: obj.TimeStamp,
    nonce: obj.Nonce,
    msg_encrypt: obj.Encrypt
  })
  xml = util.buildObject(obj)
  return xml
}
proto.authorizationMiddlewarify = function () {
  const readFileCallback = function (req, res, next, url, err, result) {
    if (err) {
      return next(err)
    }
    res.write(result.replace('{url}', url))
    res.end()
  }
  const getAuthorizationUrlCallback = function (req, res, next, err, url) {
    if (err) {
      return next(err)
    }
    fs.readFile(__dirname + '/../static/jump.html', 'utf8', readFileCallback.bind(this, req, res, next, url))
  }
  const middleware = function (req, res, next) {
    const isEncrypted = req.socket.encrypted
    const query = req.query || urlParser.parse(req.url, true).query
    if (query.auth_code) {
      req.query = query
      return next()
    }
    this.getAuthorizationUrl(req.url, isEncrypted, getAuthorizationUrlCallback.bind(this, req, res, next))
  }
  return middleware.bind(this)
}
proto.onComponentVerifyTicket = function (result) {
  this.componentVerifyTicket = result.componentVerifyTicket
}
proto.onComponentAccessToken = function () {
  const iteration = function (item) {
    this.addAuthorizer({
      authorizerAppId: item.authorizer_appid,
      authorizerRefreshToken: item.refresh_token
    })
  }
  const getAuthorizersCallback = function (err, result) {
    if (err) {
      return this.emit('error', err)
    }
    result.list.forEach(iteration.bind(this))
    this.emit('init_authorizer', result.list)
  }
  this.getAuthorizers(getAuthorizersCallback.bind(this))
}
proto.onAuthorized = function (result) {
  const options = {
    authorizerAppId: result.authorizerAppId,
    authorizationCode: result.authorizationCode,
  }
  this.addAuthorizer(options)
}
proto.onUnauthorized = function (result) {
  this.authorizer = this.authorizer.filter(function (item) {
    const isSame = item.authorizerAppId === result.authorizerAppId
    if (isSame) {
      item.stop()
    }
    return !isSame
  })
}
proto.addAuthorizer = function (options) {
  options = options || {}
  const isAdded = this.authorizer.some(function (item) {
    if (item.authorizerAppId === options.authorizerAppId) {
      return true
    }
  })
  if (isAdded) {
    return this.emit('error', new error.WechatOpenToolkitError('The authorizerAppId already exists'))
  }
  const authorizer = new Authorizer({
    authorizerAppId: options.authorizerAppId,
    authorizationCode: options.authorizationCode,
    authorizerRefreshToken: options.authorizerRefreshToken,
    component: this
  })
  const onAuthorizerToken = function (result) {
    result.componentAppId = this.componentAppId
    this.emit('authorizer_token', result)
  }
  authorizer
    .on('error', this.emit.bind(this, 'error'))
    .on('authorizer_token', onAuthorizerToken.bind(this))
    .start()
  this.authorizer.push(authorizer)
}
proto.getAuthorizer = function (authorizerAppId) {
  for (let i = 0, len = this.authorizer.length; i < len; i++) {
    if (this.authorizer[i].authorizerAppId === authorizerAppId) {
      return this.authorizer[i]
    }
  }
}
proto.getAuthorizerAccessToken = function (authorizerAppId, callback) {
  const onAuthorizerToken = function (result) {
    callback(null, result.authorizerAccessToken)
  }
  const authorizer = this.getAuthorizer(authorizerAppId)
  if (!authorizer) {
    callback(new error.WechatOpenToolkitError('The authorizerAppId does not exist'))
  } else if (authorizer.authorizerAccessToken) {
    callback(null, authorizer.authorizerAccessToken)
  } else {
    authorizer.once('authorizer_token', onAuthorizerToken)
  }
}
proto.getComponentAccessToken = function (callback) {
  if (!this.componentVerifyTicket) {
    return callback(new error.WechatOpenToolkitError('The component verify ticket does not exists!'))
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/component/api_component_token'
  const body = {
    component_appid: this.componentAppId,
    component_appsecret: this.componentAppSecret,
    component_verify_ticket: this.componentVerifyTicket
  }
  util.request({
    url: url,
    method: 'post',
    body: body,
    json: true
  }, util.wrapper(callback))
}
proto.getPreAuthCode = function (callback) {
  if (!this.componentAccessToken) {
    return callback(new error.WechatOpenToolkitError('The component access token does not exists!'))
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/component/api_create_preauthcode'
  const query = {
    component_access_token: this.componentAccessToken
  }
  const body = {
    component_appid: this.componentAppId 
  }
  const newUrl = url + '?' + querystring.stringify(query)
  util.request({
    url: newUrl,
    method: 'post',
    body: body,
    json: true
  }, util.wrapper(callback))
}
proto.getAuthorizationUrl = function (redirectUrl, isEncrypted, callback) {
  const getPreAuthCodeCallback = function (err, result) {
    if (err) {
      return callback(err)
    }
    const url = 'https://mp.weixin.qq.com/cgi-bin/componentloginpage'
    redirectUrl = (isEncrypted ? 'https://' : 'http://') + this.host + redirectUrl
    const query = {
      component_appid: this.componentAppId,
      pre_auth_code: result.pre_auth_code,
      redirect_uri: redirectUrl
    }
    const newUrl = url + '?' + querystring.stringify(query)
    callback(null, newUrl)
  }
  this.getPreAuthCode(getPreAuthCodeCallback.bind(this))
}
proto.getAuthorizers = function (callback) {
  if (!this.componentAccessToken) {
    return callback(new error.WechatOpenToolkitError('The component access token does not exists!'))
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_list'
  const query = {
    component_access_token: this.componentAccessToken
  }
  const body = {
    component_appid: this.componentAppId,
    offset: 0,
    count: 500
  }
  const newUrl = url + '?' + querystring.stringify(query)
  util.request({
    url: newUrl,
    method: 'post',
    body: body,
    json: true
  }, util.wrapper(callback))
}
proto.getOauthUrl = function (options) {
  options = options || {}
  const url = 'https://open.weixin.qq.com/connect/oauth2/authorize'
  const query = {
    appid: options.authorizerAppId,
    redirect_uri: encodeURIComponent(options.redirectUrl),
    response_type: 'code',
    scope: options.scope || 'snsapi_base',
    state: options.state || '',
    component_appid: this.componentAppId
  }
  const keys = ['appid', 'redirect_uri', 'response_type', 'scope', 'state', 'component_appid']
  const iteration = function (item) {
    return item + '=' + query[item]
  }
  const querystr = keys.map(iteration).join('&')
  const newUrl = url + '?' + querystr + '#wechat_redirect'
  return newUrl
}
proto.getOauthAccessToken = function (options, callback) {
  if (!this.componentAccessToken) {
    return callback(new error.WechatOpenToolkitError('The component access token does not exists!'))
  }
  const url = 'https://api.weixin.qq.com/sns/oauth2/component/access_token'
  const query = {
    appid: options.authorizerAppId,
    code: options.code,
    grant_type: 'authorization_code',
    component_appid: this.componentAppId,
    component_access_token: this.componentAccessToken
  }
  const newUrl = url + '?' + querystring.stringify(query)
  const newOptions = {
    url: newUrl,
    method: 'get',
    json: true
  }
  util.request(newOptions, util.wrapper(callback))
}
proto.getUserInfo = function (options, callback) {
  const url = 'https://api.weixin.qq.com/sns/userinfo'
  const query = {
    access_token: options.accessToken,
    openid: options.openId,
    lang: 'zh_CN'
  }
  const newUrl = url + '?' + querystring.stringify(query)
  const newOptions = {
    url: newUrl,
    method: 'get',
    json: true
  }
  util.request(newOptions, util.wrapper(callback))
}
proto.oauthMiddlewarify = function (options) {
  const getUserInfoCallback = function (req, res, next, err, result) {
    const isFunc = typeof next === 'function'
    if (err) {
      this.emit('error', err)
      isFunc && next(err)
      return
    }
    req.wxuser = result
    isFunc && next()
  }
  const onComponentAccessToken = function (code, req, res, next) {
    this.getOauthAccessToken({
      authorizerAppId: options.authorizerAppId,
      code: code
    }, getOauthAccessTokenCallback.bind(this, req, res, next))
  }
  const getOauthAccessTokenCallback = function (req, res, next, err, result) {
    const isFunc = typeof next === 'function'
    if (err) {
      this.emit('error', err)
      isFunc && next(err)
      return
    }
    if (options.scope === 'snsapi_base') {
      req.wxuser = result
      isFunc && next()
      return
    }
    this.getUserInfo({
      accessToken: result.access_token,
      openId: result.openid
    }, getUserInfoCallback.bind(this, req, res, next))
  }
  const middleware = function (req, res, next) {
    const urlObj = urlParser.parse(req.url, true)
    const query = urlObj.query
    if (!query.code) {
      const redirectUrl = (req.socket.encrypted ? 'https://' : 'http://') + this.host + req.url
      const newOptions = {
        authorizerAppId: options.authorizerAppId,
        redirectUrl: redirectUrl,
        scope: options.scope
      }
      res.writeHead(302, {
        Location: this.getOauthUrl(newOptions)
      })
      return res.end()
    }
    if (this.componentAccessToken) {
      this.getOauthAccessToken({
        authorizerAppId: options.authorizerAppId,
        code: query.code
      }, getOauthAccessTokenCallback.bind(this, req, res, next))
    } else {
      this.on('component_access_token', onComponentAccessToken.bind(this, code, req, res, next))
    }
  }
  return middleware.bind(this)
}
proto.start = function () {
  const callback = function (err, result) {
    if (err) {
      this.emit('error', err)
      this.timer = setTimeout(this.start.bind(this), 1000 * 60 * 10)
      return
    }
    this.componentAccessToken = result.component_access_token
    this.emit('component_access_token', {
      componentAppId: this.componentAppId,
      componentAccessToken: this.componentAccessToken,
      expiresIn: parseInt(result.Expires_in)
    })
    this.timer = setTimeout(this.start.bind(this), (result.expires_in - 60 * 10) * 1000)
  }
  this.getComponentAccessToken(callback.bind(this))
}

Object.assign(Component.prototype, proto)

module.exports = Component