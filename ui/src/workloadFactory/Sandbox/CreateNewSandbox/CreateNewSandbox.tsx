import { Spinner, StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './CreateNewSandbox.module.scss';
import CreateNewSandboxHeader from './CreateNewSandboxHeader/CreateNewSandboxHeader';
import CreateNewSandboxFooter from './CreateNewSandboxFooter/CreateNewSandboxFooter';
import CreateNewSandboxContent from './CreateNewSandboxContent/CreateNewSandboxContent';
import CreateNewSandboxCodebox from './CreateNewSandboxCodebox/CreateNewSandboxCodebox';
import CreateSandboxApis from './CreateNewSandboxContent/CreateNewSandboxApis';
import { useAppSelector } from '../../../store/storeHooks';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setTargetDatabase } from '../../../store/workloadFactory/createSandboxSlice';

const CreateNewSandbox = () => {
    const loading = useAppSelector(state => state?.msSqlAction?.isLoading);
    const dispatch = useDispatch();

    CreateSandboxApis();

    //To intialize values on first render
    useEffect(() => {
        dispatch(setTargetDatabase(`DBname_sandbox_${Date.now()}`));
    }, []);

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
