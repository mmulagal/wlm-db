import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import MSSqlFooter from '../MSSqlServer/MSSqlFooter/MSSqlFooter';

import MSSqlHeader from '../MSSqlServer/MSSqlHeader/MSSqlHeader';
import styles from './MainComponent.module.scss';
import { Spinner } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import CreateMsSqlLayout from '../CreateMsSqlLayout/CreateMsSqlLayout';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import CodeBox from '../CodeBox/CodeBox';
import { useState } from 'react';
import MssqlApis from '../MSSqlServer/MssqlApis';

const MainComponent = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);
    const showChatbot = useAppSelector(state => state.auth?.isWorkloadFactory);
    const [selectedTab, setSelectedTab] = useState<'wizard' | 'chatbot'>('wizard');

    MssqlApis();

    return showChatbot && window.location.pathname === '/databases' ? (
        <div className={styles.mainContainer}>
            <div className={styles.spinnerPlacement}>
                <Spinner isLarge />
            </div>
        </div>
    ) : (
        <div className={styles.mainContainer}>
            {loading && (
                <>
                    <div className={styles.loaderOverlay}></div>
                    <div className={styles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
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
        </div>
    );
};

export default MainComponent;
