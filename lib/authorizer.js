const querystring = require('querystring')
const crypto = require('crypto')
const { validator } = require('./util')
const { https } = require('./network')

// 客服消息类型列表
const MSG_TYPE_TEXT = 'text'
const MSG_TYPE_IMAGE = 'image'
const MSG_TYPE_VOICE = 'voice'
const MSG_TYPE_VIDEO = 'video'
const MSG_TYPE_MUSIC = 'music'
const MSG_TYPE_NEWS = 'news' // 图文消息（点击跳转到外链）
const MSG_TYPE_MP_NEWS = 'mpnews' // 图文消息（点击跳转到图文消息页面）
const MSG_TYPE_MSG_MENU = 'msgmenu' // 菜单消息
const MSG_TYPE_WX_CARD = 'wxcard' // 卡券
const MSG_TYPE_MINI_PROGRAM_PAGE = 'miniprogrampage' // 小程序卡片

/**
 * 获取授权方的access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizationCode 授权码。公众号或小程序授权给第三方平台时得到
 */
async function getAccessToken(componentAppId, componentAccessToken, authorizationCode) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_query_auth'
    let query = { component_access_token: componentAccessToken }
    const body = { component_appid: componentAppId, authorization_code: authorizationCode }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取授权方的js api ticket
 * @param {string} authorizerAccessToken 授权方的access token
 */
async function getJsApiTicket(authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket'
    let query = { access_token: authorizerAccessToken, type: 'jsapi' }
    url += '?' + querystring.stringify(query)
    let ret = await https.get(url)

    return validator(ret)
}

/**
 * 获取授权方的账号基本信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 */
async function getAuthorizerInfo(componentAppId, componentAccessToken, authorizerAppId) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_info'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, authorizer_appid: authorizerAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)

    return validator(ret)
}

/**
 * 获取授权方的选项设置信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} optionName 选项名
 */
async function getAuthorizerOptionInfo(componentAppId, componentAccessToken, authorizerAppId, optionName) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_option'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, authorizer_appid: authorizerAppId, option_name: optionName }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)

    return validator(ret)
}

/**
 * 设置授权方选项信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} optionName 选项名
 * @param {number} optionValue 选项值
 */
async function setAuthorizerOption(componentAppId, componentAccessToken, authorizerAppId, optionName, optionValue) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_set_authorizer_option'
    let query = { component_access_token: componentAccessToken }
    let body = {
        component_appid: componentAppId, authorizer_appid: authorizerAppId,
        option_name: optionName, option_value: optionValue.toString()
    }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 创建开放平台帐号并绑定公众号/小程序
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function createOpenAccount(authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/create'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId }
    url += '?' + querystring.stringify(query)
    
    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 将公众号/小程序绑定到开放平台帐号下
 * @param {string} openAppId 开放平台账号appid
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/bind'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId, open_appid: openAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 将公众号/小程序从开放平台帐号下解绑
 * @param {string} openAppId 开放平台账号appid
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/unbind'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId, open_appid: openAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取公众号/小程序所绑定的开放平台帐号
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方access token
 */
async function getOpenAccount(authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/get'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取授权方的Js API config
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerJsApiTicket 授权方 js api ticket
 * @param {string} url 要配置的url
 */
function getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url) {
    let query = {
        noncestr: Math.random().toString(36).slice(2, 18),
        timestamp: Date.now(),
        url: url.split('#')[0],
        jsapi_ticket: authorizerJsApiTicket
    }

    let keyValPair = Object.entries(query).map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    keyValPair.sort()
    let str = keyValPair.join('&')
    let signature = crypto.createHash('sha1').update(str).digest('hex')

    return { appId: authorizerAppId, timestamp: query.timestamp, nonceStr: query.noncestr, signature}
}

/**
 * 获取授权方网页授权URL
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} scope 授权类型
 * @param {string} state 授权附带值
 * @param {string} redirectUrl 授权后的重定向URL
 */
function getOAuthUrl(componentAppId, authorizerAppId, scope = 'snsapi_base', state = '', redirectUrl) {
    const url = 'https://open.weixin.qq.com/connect/oauth2/authorize'
    const query = {
        appid: authorizerAppId,
        redirect_uri: encodeURIComponent(redirectUrl),
        response_type: 'code',
        scope, state,
        component_appid: componentAppId
    }
    const keys = ['appid', 'redirect_uri', 'response_type', 'scope', 'state', 'component_appid']
    const iteration = function (item) {
        return item + '=' + query[item]
    }
    const querystr = keys.map(iteration).join('&')
    const newUrl = url + '?' + querystr + '#wechat_redirect'
    return newUrl
}

/**
 * 获取授权方的网页授权access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} code 网页授权code
 */
async function getOauthAccessToken(componentAppId, componentAccessToken, authorizerAppId, code) {
    let url = 'https://api.weixin.qq.com/sns/oauth2/component/access_token'
    let query = {
        appid: authorizerAppId,
        code,
        grant_type: 'authorization_code',
        component_appid: componentAppId,
        component_access_token: componentAccessToken
    }
    url += '?' + querystring.stringify(query)
    let ret = https.get(url)
    return validator(ret)
}

/**
 * 获取微信用户信息
 * @param {string} authorizerAccessToken 授权方access token
 * @param {string} openId 微信用户openId
 */
async function getUserInfo(authorizerAccessToken, openId) {
    let url = 'https://api.weixin.qq.com/sns/userinfo'
    let query = { access_token: authorizerAccessToken, openid: openId, lang: 'zh_CN' }
    url += '?' + querystring.stringify(query)
    let ret = await https.get(url)
    return validator(ret)
}

/**
 * 刷新授权方的 access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerRefreshToken 授权方 refresh token
 */
async function refreshAccessToken(componentAppId, componentAccessToken, authorizerAppId, authorizerRefreshToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_authorizer_token'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, authorizer_appid: authorizerAppId, authorizer_refresh_token: authorizerRefreshToken }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 发送客服消息
 * @param {string} authorizerAccessToken 授权方access token
 * @param {string} openId 微信用户openId
 * @param {string} type 消息类型
 * @param {Object} body 消息主体
 */
async function send(authorizerAccessToken, openId, type, body) {
    let url = 'https://api.weixin.qq.com/cgi-bin/message/custom/send'
    let query = {
        access_token: authorizerAccessToken
    }
    let body = {
        touser: openId,
        msgtype: type,
        [type]: body
    }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

const refreshAccessTokenCallback = function (err, body) {
    if (err) {
        return this.emit('error', err)
    }
    const result = body.authorization_info || body
    this.authorizerAccessToken = result.authorizer_access_token
    this.authorizerRefreshToken = result.authorizer_refresh_token
    this.emit('authorizer_token', {
        authorizerAppId: this.authorizerAppId,
        authorizerAccessToken: this.authorizerAccessToken,
        authorizerRefreshToken: this.authorizerRefreshToken,
        expiresIn: parseInt(result.expires_in)
    })
    clearTimeout(this.tokenTimer)
    this.tokenTimer = setTimeout(this.startRefreshAccessToken.bind(this), (result.expires_in - 60 * 10) * 1000)
}

proto.startRefreshAccessToken = function () {
    const onComponentAccessToken = function () {
        if (this.authorizerRefreshToken) {
            this.refreshAccessToken(refreshAccessTokenCallback.bind(this))
        } else if (this.authorizationCode) {
            this.getAccessToken(refreshAccessTokenCallback.bind(this))
        }
    }
    if (this.component.componentAccessToken) {
        onComponentAccessToken.call(this) 
    } else {
        this.component.once('component_access_token', onComponentAccessToken.bind(this))
    }
}

proto.startRefreshJsApiTicket = function () {
    const getJsApiTicketCallback = function (err, result) {
        if (err) {
            return this.emit('error', err)
        }
        this.authorizerJsApiTicket = result.ticket
        this.emit('authorizer_jsapi_ticket', {
            authorizerAppId: this.authorizerAppId,
            authorizerJsApiTicket: this.authorizerJsApiTicket,
            expiresIn: parseInt(result.expires_in)
        })
        clearTimeout(this.ticketTimer)
        this.ticketTimer = setTimeout(this.startRefreshJsApiTicket.bind(this), (result.expires_in - 60 * 10) * 1000)
    }
    if (this.authorizerAccessToken) {
        this.getJsApiTicket(getJsApiTicketCallback.bind(this))
    } else {
        this.once('authorizer_token', this.getJsApiTicket.bind(this, getJsApiTicketCallback.bind(this)))
    }
}

proto.start = function () {
    this.startRefreshAccessToken()
    this.startRefreshJsApiTicket()
}

proto.stop = function () {
    clearTimeout(this.tokenTimer)
    clearTimeout(this.ticketTimer)
}

module.exports = {
    getAccessToken, getJsApiTicket, getAuthorizerInfo, getAuthorizerOptionInfo, setAuthorizerOption,
    createOpenAccount, bindOpenAccount, unbindOpenAccount, getOpenAccount, getJsApiConfig, getOAuthUrl,
    getOauthAccessToken, getUserInfo, refreshAccessToken, send, 

    MSG_TYPE_TEXT, MSG_TYPE_IMAGE, MSG_TYPE_VOICE, MSG_TYPE_VIDEO, MSG_TYPE_MUSIC, MSG_TYPE_NEWS,
    MSG_TYPE_MP_NEWS, MSG_TYPE_MSG_MENU, MSG_TYPE_WX_CARD, MSG_TYPE_MINI_PROGRAM_PAGE
}