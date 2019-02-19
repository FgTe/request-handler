import Dialogs from '../plain_dialogs';
import { StackActions } from 'react-navigation';

import { getNavigator } from '../../pages/navigator';
import store from '../../redux/store';

module.exports = {
    urlPrefix: '',
    requestInterception: (config) => {
        return config;
    },
    responseInterception: (response) => {
        if ( response.data.code === undefined ) {
            Dialogs.open(`Exceptional response from ${response.config.url}`);
        } else {
            let code = response.data.code;
            if ( code === 403 ) {
                let navigationState = getNavigator().state.nav.routes[getNavigator().state.nav.routes.length - 1];
                let navigateConfig = {
                    routeName: 'Login',
                    params: {
                        forwardTo: navigationState,
                    }
                };
                let navigateAction = getNavigator().state.nav.routes.length > 1 ? StackActions.replace(navigateConfig) : StackActions.push(navigateConfig);
                getNavigator().dispatch(navigateAction);
                store.dispatch({ type: 'logout' });
            } else if ( code !== 100 ) {
                Dialogs.open(response.data.des);
            }
        }
        return response;
    },
    networdErrorHandle (err, config) {
        if ( err.message === 'Canceled since component unmounting' ) {
            return { data: { code: -1, des: err.message } };
        } else if ( err.message === 'Network Error' ) {
            config.quietly || Dialogs.open('网络异常');
            return { data: { code: -2, des: err.message } };
        } else {
            config.quietly || Dialogs.open(err.message);
        }
        throw err;
    }
}