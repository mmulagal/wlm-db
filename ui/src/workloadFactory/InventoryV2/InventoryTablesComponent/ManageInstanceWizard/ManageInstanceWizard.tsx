import { useWizard, WizardContextProvider } from '@netapp/design-system/dist/components/Wizard';
import { StepLayout, WizardContent, WizardHeader } from '@netapp/design-system';
import styles from './ManageInstanceWizard.module.scss';
import * as DetectInstanceStep from './DetectInstanceStep/DetectInstanceStep';
import * as ManageInstanceStep from './ManageInstanceStep/ManageInstanceStep';
import { useNavigate } from 'react-router-dom';
import ManageOnlyWizard from './ManageOnlyWizard';

const MANAGE_STEPS = [
    { key: 'detect-instance', label: 'Detect instance', component: DetectInstanceStep },
    { key: 'manage-instance', label: 'Manage instance', component: ManageInstanceStep }
];

const stepsMap = Object.fromEntries(MANAGE_STEPS.map(({ key, component }) => [key, component]));

const stepPaths = {
    regular: MANAGE_STEPS.map(({ label, key }) => ({ label, key }))
};

const Wizard = () => {
    const { stepsMap, currentStep }: any = useWizard();
    const navigate = useNavigate();

    const { Footer: StepFooter, Content: StepContent } = stepsMap[currentStep];
    return (
        <StepLayout>
            <WizardHeader
                className={styles['manage-instance-wizard']}
                title={'Manage instance'}
                onExit={() => {
                    navigate('../databases/inventory');
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

const ManageInstanceWizard = () => {
    const initialState: any = {};
    const isAlreadyDetected = true;
    return (
        <>
            {isAlreadyDetected && (
                <>
                    <ManageOnlyWizard />
                </>
            )}
            {!isAlreadyDetected && (
                <WizardContextProvider
                    stepsMap={stepsMap}
                    stepPaths={stepPaths}
                    initialStep={'detect-instance'}
                    initialPath={'regular'}
                    initialState={initialState}
                >
                    <Wizard />
                </WizardContextProvider>
            )}
        </>
    );
};

export default ManageInstanceWizard;
