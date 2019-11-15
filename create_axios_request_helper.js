import axios from 'zzc-axios'

const GLOBAL_LOCKS = {}

function Abortion() {
    return {
        then: Abortion,
        catch: Abortion
    }
}

const ERROR_ABORT_BY_REPEAT = 'Canceled since a new request emitting'

function _symbelRequest(symbel, record, config, handle, callback) {
    let _symbel = symbel ? symbel : config.url
    if (_symbel) {
        return handle.call(this, _symbel, record, config, callback)
    } else {
        return this.request(config)
    }
}
function _lockedRequest(symbel, record, config, unlockCallback) {
    if (record[symbel]) {
        return Abortion()
    } else {
        record[symbel] = true
        let callback = () => {
            typeof unlockCallback === 'function' && unlockCallback()
        }
        return this.request(config).then((response) => {
            record[symbel] = null
            callback()
            return response
        }, (error) => {
            record[symbel] = null
            callback()
            throw error
        });
    }
}
function _latestRequest(symbel, record, config) {
    let canceler = record[symbel]
    if (canceler) {
        if (canceler.requesting) {
            record[symbel].source.cancel(ERROR_ABORT_BY_REPEAT)
            record[symbel] = {
                source: config.cancelToken ? config.cancelToken : axios.CancelToken.source()
            }
        }
    } else {
        record[symbel] = {
            source: config.cancelToken ? config.cancelToken : axios.CancelToken.source()
        }
    }
    record[symbel].requesting = true
    return new Promise((resolve, reject) => {
        this.request({
            ...config,
            cancelToken: record[symbel].source.token
        }).then((response) => {
            record[symbel].requesting = false
            resolve(response)
        }, (error) => {
            if (error.message !== ERROR_ABORT_BY_REPEAT) {
                reject(error)
            }
        })
    })
}

export default function createRequestHelper(config) {
    let defaultUrlPrefix = config.urlPrefix || ''
    let defaultRequestInterception = config.requestInterception || ((config) => {
        return config
    })
    let defaultResponseInterception = config.responseInterception || ((response) => {
        return response
    })
    let defaultNetwordErrorHandle = config.networdErrorHandle || ((err) => {
        throw err
    })
    return class {
        constructor(config) {
            let { urlPrefix, requestInterception, responseInterception, networdErrorHandle, ...presetRequestConfig } = config || {}
            this.defaultConfig = {
                urlPrefix: urlPrefix || defaultUrlPrefix,
                requestInterception: requestInterception || defaultRequestInterception,
                responseInterception: responseInterception || defaultResponseInterception,
                networdErrorHandle: networdErrorHandle || defaultNetwordErrorHandle,
            }
            this.presetRequestConfig = presetRequestConfig
            this.request = this.request.bind(this)
            this.lockedRequest = this.lockedRequest.bind(this)
            this.latestRequest = this.latestRequest.bind(this)
            this.source = axios.CancelToken.source()
            this.locks = {}
            this.latest = {}
        }
        request(config) {
            let requestInterceptionInThisRequest = this.defaultConfig.requestInterception
            let responseInterceptionInThisRequest = this.defaultConfig.responseInterception
            let networdErrorHandleInThisRequets = this.defaultConfig.networdErrorHandle
            let requestConfig = {
                url: this.defaultConfig.urlPrefix,
                cancelToken: this.source.token
            }
            for (let prop in config) {
                if (config.hasOwnProperty(prop)) {
                    if (prop === 'url') {
                        requestConfig.url += config[prop]
                    } else if (prop === 'requestInterception' && typeof config[prop] === 'function') {
                        requestInterceptionInThisRequest = config[prop]
                    } else if (prop === 'responseInterception' && typeof config[prop] === 'function') {
                        responseInterceptionInThisRequest = config[prop]
                    } else if (prop === 'networdErrorHandle' && typeof config[prop] === 'function') {
                        networdErrorHandleInThisRequets = config[prop]
                    } else {
                        requestConfig[prop] = config[prop]
                    }
                }
            }
            return new Promise((resolve, reject) => {
                axios.request(requestInterceptionInThisRequest(requestConfig)).then((response) => {
                    resolve(responseInterceptionInThisRequest(response, config))
                }, (error) => {
                    let raise = true
                    try {
                        let resolved = networdErrorHandleInThisRequets(error, config, () => { raise = false })
                        if (raise) {
                            resolve(resolved)
                        }
                    } catch (error) {
                        if (raise) {
                            reject(error)
                        }
                    }

                })
            })
        }
        lockedRequest(config, options) {
            let { symbel, onunlock } = options || {}
            return _symbelRequest.call(this, symbel, this.locks, config, _lockedRequest, onunlock)
        }
        globalLockedRequest(config, options) {
            let { symbel, onunlock } = options || {}
            return _symbelRequest.call(this, symbel, GLOBAL_LOCKS, config, _lockedRequest, onunlock)
        }
        latestRequest(config, options) {
            let { symbel } = options || {}
            return _symbelRequest.call(this, symbel, this.latest, config, _latestRequest)
        }
        abort(message) {
            this.source.cancel(message)
            for (let key in this.latest) {
                if (this.latest.hasOwnProperty(key) && this.latest[key].requesting) {
                    this.latest[key].source.cancel(message)
                }
            }
        }
    }
}