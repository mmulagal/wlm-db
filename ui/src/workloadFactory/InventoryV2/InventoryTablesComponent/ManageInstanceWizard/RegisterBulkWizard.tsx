import { useWizard, WizardContextProvider } from '@netapp/design-system/dist/components/Wizard';
import { StepLayout, WizardContent, WizardHeader } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { DsSpinner } from '@tlveng/wlm-ds';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './ManageInstanceWizard.module.scss';
import * as DetectInstanceStep from './DetectInstanceStep/DetectInstanceStep';
import * as ManageInstanceStep from './ManageInstanceStep/ManageInstanceStep';
import * as SelectInstancesStep from './SelectInstancesStep/SelectInstancesStep';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';
import { DBType } from '../../../../utils/consts';

const Wizard = () => {
    const { t } = useTranslation();
    const { stepsMap, currentStep }: any = useWizard();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { loading } = useAppSelector(state => state.agenticAI.agenticRegisterFlowChecks);

    const { Footer: StepFooter, Content: StepContent } = stepsMap[currentStep];
    return (
        <StepLayout>
            {loading && (
                <>
                    <div className={styles.loaderOverlay} />
                    <div className={styles.spinnerPlacement}>
                        <DsSpinner isLarge />
                    </div>
                </>
            )}
            <WizardHeader
                className={styles['manage-instance-wizard']}
                title={t('databases.register-flow.register-instance')}
                onExit={() => {
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
    const { selectedHostType } = useAppSelector(state => state.inventoryV2);

    const MANAGE_STEPS = [
        {
            key: 'select-instances',
            label:
                selectedHostType === DBType.ORACLE
                    ? t('databases.register-flow.select-databases')
                    : t('databases.register-flow.select-instances'),
            component: SelectInstancesStep
        },
        { key: 'detect-instance', label: t('databases.register-flow.authenticate'), component: DetectInstanceStep },
        { key: 'manage-instance', label: t('databases.register-flow.prepare'), component: ManageInstanceStep }
    ];

    const stepsMap = Object.fromEntries(MANAGE_STEPS.map(({ key, component }) => [key, component]));

    const stepPaths = {
        regular: MANAGE_STEPS.map(({ label, key }) => ({ label, key }))
    };
    const initialState: any = {};

    return (
        <WizardContextProvider
            stepsMap={stepsMap}
            stepPaths={stepPaths}
            initialStep="select-instances"
            initialPath="regular"
            initialState={initialState}
        >
            <Wizard />
        </WizardContextProvider>
    );
};

export default RegisterBulkWizard;
