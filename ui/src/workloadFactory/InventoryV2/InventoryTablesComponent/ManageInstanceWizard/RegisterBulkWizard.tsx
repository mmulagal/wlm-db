import { useWizard, WizardContextProvider } from '@netapp/design-system/dist/components/Wizard';
import { StepLayout, WizardContent, WizardHeader } from '@netapp/design-system';
import styles from './ManageInstanceWizard.module.scss';
import * as DetectInstanceStep from './DetectInstanceStep/DetectInstanceStep';
import * as ManageInstanceStep from './ManageInstanceStep/ManageInstanceStep';
import * as SelectInstancesStep from './SelectInstancesStep/SelectInstancesStep';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo } from 'react';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';

const MANAGE_STEPS = [
    { key: 'select-instances', label: 'Select instances', component: SelectInstancesStep },
    { key: 'detect-instance', label: 'Authenticate', component: DetectInstanceStep },
    { key: 'manage-instance', label: 'Prepare', component: ManageInstanceStep }
];

const stepsMap = Object.fromEntries(MANAGE_STEPS.map(({ key, component }) => [key, component]));

const stepPaths = {
    regular: MANAGE_STEPS.map(({ label, key }) => ({ label, key }))
};

const Wizard = () => {
    const { stepsMap, currentStep }: any = useWizard();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { Footer: StepFooter, Content: StepContent } = stepsMap[currentStep];
    return (
        <StepLayout>
            <WizardHeader
                className={styles['manage-instance-wizard']}
                title={'Register instance'}
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
    const initialState: any = {};
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    const isAlreadyDetected = useMemo(() => {
        if (manageSingleInstanceData && manageSingleInstanceData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            return true;
        }
        return false;
    }, [manageSingleInstanceData]);

    return (
        <>
            {(wizardOperationType === 'bulk' || !isAlreadyDetected) && (
                <WizardContextProvider
                    stepsMap={stepsMap}
                    stepPaths={stepPaths}
                    initialStep={'select-instances'}
                    initialPath={'regular'}
                    initialState={initialState}
                >
                    <Wizard />
                </WizardContextProvider>
            )}
        </>
    );
};

export default RegisterBulkWizard;
