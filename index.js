import React from 'react'

import createRequestHelper from './create_axios_request_helper'

const CANCELED_BY_UNMOUNT = 'Canceled since component unmounting'
export const RequestHelper = createRequestHelper({
    responseInterception (response) {
        return response.data
    },
    networdErrorHandle (err, config, omit) {
        if ( err.message === CANCELED_BY_UNMOUNT ) {
            console.log(err.message)
            omit()
        } else {
            throw err
        }
    }
})

export default function withRequest (Component) {
    return class extends React.Component {
        static displayName = `withRequest(${Component.displayName || Component.name || 'Component'})`
        constructor (props) {
            super(props)
            this.requestHelper = new RequestHelper()
        }
        componentWillUnmount () {
            this.requestHelper.abort(CANCELED_BY_UNMOUNT)
        }
        render () {
            return <Component request={this.requestHelper.request} lockedRequest={this.requestHelper.lockedRequest} globalLockedRequest={this.requestHelper.globalLockedRequest} latestRequest={this.requestHelper.latestRequest} globalLatestRequest={this.requestHelper.globalLatestRequest} {...this.props}/>
        }
    }
}