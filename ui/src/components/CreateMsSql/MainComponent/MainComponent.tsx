import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import MSSqlFooter from '../MSSqlServer/MSSqlFooter/MSSqlFooter';

import MSSqlHeader from '../MSSqlServer/MSSqlHeader/MSSqlHeader';
import styles from './MainComponent.module.scss';
import { Spinner } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import CreateMsSqlLayout from '../CreateMsSqlLayout/CreateMsSqlLayout';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import CodeBox from '../CodeBox/CodeBox';

const MainComponent = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);
    const showChatbot = useAppSelector(state => state.auth?.isWorkloadFactory);

    return (
        <>
            <div className={styles.leftSide}>
                <StepLayout className={styles.header}>
                    <MSSqlHeader />
                    <WizardContent className={styles.content}>
                        {showChatbot ? <CreateMsSqlLayout /> : <MSSqlServer />}
                    </WizardContent>
                    <WizardFooter>
                        <MSSqlFooter />
                    </WizardFooter>
                    {loading && (
                        <>
                            <div className={styles.loaderOverlay}></div>
                            <div className={styles.spinnerPlacement}>
                                <Spinner isLarge />
                            </div>
                        </>
                    )}
                </StepLayout>
            </div>
            <div className={styles.rightSide}>
                <CodeBox />
            </div>
        </>
    );
};

export default MainComponent;
