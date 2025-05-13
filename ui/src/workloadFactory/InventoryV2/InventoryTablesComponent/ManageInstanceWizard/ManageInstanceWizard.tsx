import { useWizard, WizardContextProvider } from '@netapp/design-system/dist/components/Wizard';
import { StepLayout, WizardContent, WizardHeader } from '@netapp/design-system';
import styles from './ManageInstanceWizard.module.scss';
import * as DetectInstanceStep from './DetectInstanceStep/DetectInstanceStep';
import * as ManageInstanceStep from './ManageInstanceStep/ManageInstanceStep';
import { useNavigate } from 'react-router-dom';
import ManageOnlyWizard from './ManageOnlyWizard';
import { useAppSelector } from '../../../../store/storeHooks';
import { useMemo } from 'react';
import { INVENTORY_STATUS } from '../../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';

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
    const dispatch = useDispatch();

    const { Footer: StepFooter, Content: StepContent } = stepsMap[currentStep];
    return (
        <StepLayout>
            <WizardHeader
                className={styles['manage-instance-wizard']}
                title={'Manage instance'}
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

const ManageInstanceWizard = () => {
    const initialState: any = {};
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const isAlreadyDetected = useMemo(() => {
        if (manageSingleInstanceData && manageSingleInstanceData?.statusColText === INVENTORY_STATUS.UNMANAGED) {
            return true;
        }
        return false;
    }, [manageSingleInstanceData]);

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
