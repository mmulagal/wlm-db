import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import MSSqlFooter from '../MSSqlServer/MSSqlFooter/MSSqlFooter';

import MSSqlHeader from '../MSSqlServer/MSSqlHeader/MSSqlHeader';
import styles from './MainComponent.module.scss';
import { Spinner } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import CreateMsSqlLayout from '../CreateMsSqlLayout/CreateMsSqlLayout';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import CodeBox from '../CodeBox/CodeBox';
import { useState, useEffect } from 'react';
import MssqlApis from '../MSSqlServer/MssqlApis';
import ComponentLoader from '../../../common/ComponentLoader/ComponentLoader';

const MainComponent = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);
    const showChatbot = true;
    const [selectedTab, setSelectedTab] = useState<'wizard' | 'chatbot'>('wizard');
    const { statusData } = useAppSelector(state => state.headers.getStatus);
    const [statusResponse, setStatusResponse] = useState<any>(null);

    useEffect(() => {
        if (statusData?.isActive || statusData?.isActive === false) {
            setStatusResponse(true);
        } else {
            setStatusResponse(false);
        }
    }, [statusData]);

    MssqlApis();

    return showChatbot && window.location.pathname === '/databases' ? (
        <div className={styles.mainContainer}>
            <div className={styles.spinnerPlacement}>
                <Spinner isLarge />
            </div>
        </div>
    ) : (
        <div className={styles.mainContainer}>
            {(loading || statusResponse === null || !statusResponse) && (
                <>
                    <div className={styles.loaderOverlay}></div>
                    <div className={styles.spinnerPlacement}>
                        <ComponentLoader style={{ margin: '0 auto' }} />
                    </div>
                </>
            )}
            {statusResponse && (
                <>
                    <div className={`${styles.leftSide} ${!showChatbot ? styles.noChatBot : ''}`}>
                        <StepLayout className={styles.header}>
                            <MSSqlHeader />
                            <WizardContent className={styles.content}>
                                {showChatbot ? (
                                    <CreateMsSqlLayout selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
                                ) : (
                                    <MSSqlServer />
                                )}
                            </WizardContent>
                            {selectedTab === 'wizard' && (
                                <WizardFooter>
                                    <MSSqlFooter />
                                </WizardFooter>
                            )}
                        </StepLayout>
                    </div>
                    {showChatbot && (
                        <div className={styles.rightSide}>
                            <CodeBox />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MainComponent;
