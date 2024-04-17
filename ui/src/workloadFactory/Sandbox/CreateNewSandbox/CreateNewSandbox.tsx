import { Spinner, StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './CreateNewSandbox.module.scss';
import CreateNewSandboxHeader from './CreateNewSandboxHeader/CreateNewSandboxHeader';
import CreateNewSandboxFooter from './CreateNewSandboxFooter/CreateNewSandboxFooter';
import CreateNewSandboxContent from './CreateNewSandboxContent/CreateNewSandboxContent';
import CreateNewSandboxCodebox from './CreateNewSandboxCodebox/CreateNewSandboxCodebox';
import CreateSandboxApis from './CreateNewSandboxContent/CreateNewSandboxApis';

const CreateNewSandbox = () => {
    const loading = false;

    CreateSandboxApis();
    return (
        <div className={styles.createNewSandbox}>
            {loading && (
                <>
                    <div className={styles.loaderOverlay}></div>
                    <div className={styles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            <div className={styles.leftSide}>
                <StepLayout className={styles.header}>
                    <CreateNewSandboxHeader />

                    <WizardContent className={styles.content}>
                        <CreateNewSandboxContent />
                    </WizardContent>

                    <WizardFooter>
                        <CreateNewSandboxFooter />
                    </WizardFooter>
                </StepLayout>
            </div>

            <div className={styles.rightSide}>
                <CreateNewSandboxCodebox />
            </div>
        </div>
    );
};

export default CreateNewSandbox;
