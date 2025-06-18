import { useAppSelector } from './store/storeHooks';
import './App.css';
import Home from './Home';
import { BlueXPListeners, ThemeProvider, postBlueXPMessage } from '@netapp/design-system';
import ErrorPage from './common/ErrorPage/ErrorPage';
import { useInitialize } from './utils/appConfig';
import ComponentLoader from './common/ComponentLoader/ComponentLoader';
import { useEffect, useRef } from 'react';
import { DsProvider } from '@tlveng/wlm-ds';

function App() {
    const { loading, accountId, accessToken } = useAppSelector(state => state.auth);
    const readyNotifiedRef = useRef(false);

    useInitialize();

    useEffect(() => {
        if (!readyNotifiedRef.current && accessToken) {
            postBlueXPMessage({
                type: BlueXPListeners.ready
            });
            readyNotifiedRef.current = true;
        }
    }, [accessToken]);

    // @ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    return (
        <DsProvider theme="light">
            <ThemeProvider isIframe theme={isDarkTheme ? 'dark' : 'light'}>
                {loading && (
                    <div className="App">
                        <ComponentLoader style={{ margin: '0 auto' }} />
                    </div>
                )}
                {!loading && (accountId ? <Home /> : <ErrorPage message="Account Id required" />)}
            </ThemeProvider>
        </DsProvider>
    );
}

export default App;
