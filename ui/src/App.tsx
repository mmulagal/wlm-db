import { useAppSelector } from './store/storeHooks';
import './App.css';
import Home from './Home';
import { BlueXPListeners, ThemeProvider, postBlueXPMessage } from '@netapp/design-system';
import { FSxpertWidget } from '@tlveng/fsxpert-widget';
import ErrorPage from './common/ErrorPage/ErrorPage';
import { useInitialize } from './utils/appConfig';
import ComponentLoader from './common/ComponentLoader/ComponentLoader';
import { useEffect, useRef } from 'react';
import { DsProvider } from '@tlveng/wlm-ds';
import { getDomainURL } from './utils/utilityFunctions';

function App() {
    const { loading, accountId, accessToken, isDemoMode, userMetadata } = useAppSelector(state => state.auth);
    const readyNotifiedRef = useRef(false);
    // @ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    // Remove 'Bearer ' prefix from accessToken if present
    const cleanAccessToken = accessToken?.startsWith('Bearer ') ? accessToken.substring(7) : accessToken;

    const fsxpertConfig = {
        accessToken: cleanAccessToken,
        accountId,
        userMetadata,
        features: {
            active: { 'Platform.BlueXP/DarkTheme': isDarkTheme }
        },
        isDemoMode /* optional */,

        extraData: {
            domain: getDomainURL()
        }
    };

    useInitialize();

    useEffect(() => {
        if (!readyNotifiedRef.current && accessToken) {
            postBlueXPMessage({
                type: BlueXPListeners.ready
            });
            readyNotifiedRef.current = true;
        }
    }, [accessToken]);

    return (
        <DsProvider theme={isDarkTheme ? 'dark' : 'light'}>
            <ThemeProvider isIframe theme={isDarkTheme ? 'dark' : 'light'}>
                {loading && (
                    <div className="App">
                        <ComponentLoader style={{ margin: '0 auto' }} />
                    </div>
                )}
                {!loading &&
                    (accountId ? (
                        <>
                            <FSxpertWidget config={fsxpertConfig} />
                            <Home />
                        </>
                    ) : (
                        <ErrorPage message="Account Id required" />
                    ))}
            </ThemeProvider>
        </DsProvider>
    );
}

export default App;
