import React from 'react';
import axios from 'axios';

import config from './config';

let defaultUrlPrefix = config.urlPrefix || '';
let defaultRequestInterception = config.requestInterception || ((config) => {
	return config;
})
let defaultResponseInterception = config.responseInterception || ((response) => {
	return response;
});
let defaultNetwordErrorHandle = config.networdErrorHandle || ((err) => {
	if ( err.message !== 'Canceled' ) {
		console.log(err.message);
		throw err;
	}
});

function Abortion () {
	return {
		then: Abortion,
		catch: Abortion
	}
}
export default function withAxios (Component, optConfig) {
	let defaultConfig = {
		urlPrefix: defaultUrlPrefix,
		requestInterception: defaultRequestInterception,
		responseInterception: defaultResponseInterception,
		networdErrorHandle: defaultNetwordErrorHandle,
		...optConfig
	};
	let { urlPrefix, requestInterception, responseInterception, networdErrorHandle, ...presetRequestConfig } = defaultConfig;
	return class extends React.Component {
		static displayName = `withAxios(${Component.displayName || Component.name || 'Component'})`;
		constructor (props) {
			super(props);
			this.request = this.request.bind(this);
			this.lockedRequest = this.lockedRequest.bind(this);
			this.source = axios.CancelToken.source();
			this.locks = {};
		}
		request (config) {
			let url, requestInterceptionInThisRequest, responseInterceptionInThisRequest, networdErrorHandleInThisRequets, requestConfig = {};
			for ( let prop in config ) {
				if ( config.hasOwnProperty(prop) ) {
					if ( prop === 'url' ) {
						url = config[prop];
					} else if ( prop === 'requestInterception' && typeof config[prop] === 'function' ) {
						requestInterceptionInThisRequest = config[prop];
					} else if ( prop === 'responseInterception' && typeof config[prop] === 'function' ) {
						responseInterceptionInThisRequest = config[prop];
					} else if ( prop === 'networdErrorHandle' && typeof config[prop] === 'function' ) {
						networdErrorHandleInThisRequets = config[prop];
					} else {
						requestConfig[prop] = config[prop];
					}
				}
			}
			return axios.request(( requestInterceptionInThisRequest || requestInterception )({
				cancelToken: this.source.token,
				url: `${urlPrefix}${url}`,
				...presetRequestConfig,
				...requestConfig
			})).then((response) => {
				return ( responseInterceptionInThisRequest || responseInterception )(response, config);
			}, (error) => {
				return ( networdErrorHandleInThisRequets || networdErrorHandle )(error, config);
			});
		}
		lockedRequest(symbel, config, unlockCallback) {
			if ( this.locks[symbel] ) {
				return Abortion();
			} else {
				this.locks[symbel] = true;
				let callback = () => {
					typeof unlockCallback === 'function' && unlockCallback();
				}
				return this.request(config).then((response) => {
					this.locks[symbel] = null;
					callback();
					return response;
				}).catch((error) => {
					this.locks[symbel] = null;
					callback();
					throw error;
				});
			}
		}
		componentWillUnmount () {
			this.source.cancel('Canceled since component unmounting');
		}
		render () {
			return <Component request={this.request} lockedRequest={this.lockedRequest} {...this.props}/>
		}
	}
}
