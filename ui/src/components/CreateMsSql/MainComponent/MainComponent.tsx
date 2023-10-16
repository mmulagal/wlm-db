import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import MSSqlFooter from '../MSSqlServer/MSSqlFooter/MSSqlFooter';

import MSSqlHeader from '../MSSqlServer/MSSqlHeader/MSSqlHeader';
import styles from './MainComponent.module.scss';
import { Spinner } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import CreateMsSqlLayout from '../CreateMsSqlLayout/CreateMsSqlLayout';
import MSSqlServer from '../MSSqlServer/MSSqlServer';

const MainComponent = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);
    const showChatbot = localStorage.getItem('showChatbot') === 'true';

    return (
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
    );
};

export default MainComponent;
