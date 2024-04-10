import { useAppSelector } from './store/storeHooks';
import './App.css';
import Home from './Home';
import { ThemeProvider } from '@netapp/design-system';
import ErrorPage from './common/ErrorPage/ErrorPage';
import { useInitialize } from './utils/appConfig';
import FullStoryComp from './common/FullStoryComp';
import ComponentLoader from './common/ComponentLoader/ComponentLoader';
import { useEffect } from 'react';

function App() {
    const { loading, accountId } = useAppSelector(state => state.auth);

    useInitialize();

    //@ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    useEffect(() => {
        const element = document.querySelector("[class*='Toggle-module_active']");
        if (element) {
            console.log('element found');
        } else {
            console.log('element not found');
        }
    }, []);

    return (
        <>
            <ThemeProvider isIframe={true} theme={isDarkTheme ? 'dark' : 'light'}>
                <FullStoryComp />
                {loading && (
                    <div className="App">
                        <ComponentLoader style={{ margin: '0 auto' }} />
                    </div>
                )}
                {!loading && (accountId ? <Home /> : <ErrorPage message={'Account Id required'} />)}
            </ThemeProvider>
        </>
    );
}

export default App;
