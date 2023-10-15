import { useAppSelector } from './store/storeHooks';
import './App.css';
import Home from './Home';
import { Spinner, ThemeProvider } from '@netapp/design-system';
import ErrorPage from './common/ErrorPage/ErrorPage';
import { useInitialize } from './utils/appConfig';
import FullStoryComp from './common/FullStoryComp';
import { useEffect, useState } from 'react';

function App() {
    const { loading, accountId } = useAppSelector(state => state.auth);
    const [darkTheme, setDarkTheme] = useState(false);

    useInitialize();

    //@ts-ignore
    const isDarkTheme = useAppSelector(state => state?.features?.byKey['Platform.BlueXP/DarkTheme'].active);

    useEffect(() => {
        setDarkTheme(isDarkTheme);
    }, [isDarkTheme]);

    return (
        <>
            <ThemeProvider isIframe={true} theme={darkTheme ? 'dark' : 'light'}>
                <FullStoryComp />
                {loading && (
                    <div className="App">
                        <Spinner isLarge />
                    </div>
                )}
                {!loading && (accountId ? <Home /> : <ErrorPage message={'Account Id required'} />)}
            </ThemeProvider>
        </>
    );
}

export default App;
