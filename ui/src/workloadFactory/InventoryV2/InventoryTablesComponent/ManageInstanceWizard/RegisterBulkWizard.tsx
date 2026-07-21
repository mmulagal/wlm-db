import { useWizard, WizardContextProvider } from '@netapp/design-system/dist/components/Wizard';
import { StepLayout, WizardContent, WizardHeader } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './ManageInstanceWizard.module.scss';
import * as ManageInstanceStep from './ManageInstanceStep/ManageInstanceStep';
import * as AuthenticateBulkInstance from './SelectInstancesStep/AuthenticateBulkInstance';
import * as AuthenticateOracleBulkInstance from './SelectInstancesStep/AuthenticateOracleBulkInstance';

import {
    setLandingFromWizard,
    resetInstanceAuthStatus,
    resetFsxAuthStatus,
    setBulkWizardStartAtFsxStep
} from '../../../../store/workloadFactory/inventoryV2Slice';
import { DBType } from '../../../../utils/consts';

const Wizard = () => {
    const { t } = useTranslation();
    const { stepsMap, currentStep }: any = useWizard();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { Footer: StepFooter, Content: StepContent } = stepsMap[currentStep];
    const { registerHostType } = useAppSelector(state => state.inventoryV2);
    return (
        <StepLayout>
            <WizardHeader
                className={styles['manage-instance-wizard']}
                title={
                    registerHostType === DBType.MSSQL
                        ? t('databases.register-flow.register-instance')
                        : t('databases.register-flow.register-database')
                }
                onExit={() => {
                    // Reset auth status for fresh state on next registration
                    dispatch(resetInstanceAuthStatus());
                    dispatch(resetFsxAuthStatus());
                    setTimeout(() => {
                        dispatch(setLandingFromWizard(true));
                        navigate('../databases/inventory');
                    }, 100);
                }}
            />
            <WizardContent
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <StepContent />
            </WizardContent>
            {StepFooter && <StepFooter />}
        </StepLayout>
    );
};

const RegisterBulkWizard = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { selectedHostType, bulkWizardStartAtFsxStep } = useAppSelector(state => state.inventoryV2);

    const isOracle = selectedHostType === DBType.ORACLE;

    const MANAGE_STEPS = [
        {
            key: isOracle ? 'authenticate-database' : 'authenticate-instance',
            label: isOracle
                ? t('databases.register-flow.authenticate-database')
                : t('databases.register-flow.authenticate-instance'),
            component: isOracle ? AuthenticateOracleBulkInstance : AuthenticateBulkInstance
        },
        /*
         * FSx authentication step commented out for this sprint per Global WAD Gradual Trust plan
         * FSx link validation now happens before user enters registration wizard
         * TODO: Remove in next sprint when FSx link + credential flow is finalized
        {
            key: 'authenticate-fsx',
            label: t('databases.register-flow.authenticate-fsx-for-ontap'),
            component: AuthenticateFSxStep
        },
        */
        {
            key: 'manage-instance',
            label: t('databases.register-flow.prepare'),
            component: ManageInstanceStep
        }
    ];

    const stepsMap = Object.fromEntries(MANAGE_STEPS.map(({ key, component }) => [key, component]));

    const stepPaths = {
        regular: MANAGE_STEPS.map(({ label, key }) => ({ label, key }))
    };
    const initialState: any = {};

    // Determine initial step based on whether we're coming from replica authentication
    const getInitialStep = () =>
        /* FSx step commented out - skipping FSx step logic
        if (bulkWizardStartAtFsxStep) {
            // Clear the flag after reading it
            dispatch(setBulkWizardStartAtFsxStep(false));
            return 'authenticate-fsx';
        }
        */
        isOracle ? 'authenticate-database' : 'authenticate-instance';
    return (
        <WizardContextProvider
            stepsMap={stepsMap}
            stepPaths={stepPaths}
            initialStep={getInitialStep()}
            initialPath="regular"
            initialState={initialState}
        >
            <Wizard />
        </WizardContextProvider>
    );
};

export default RegisterBulkWizard;
