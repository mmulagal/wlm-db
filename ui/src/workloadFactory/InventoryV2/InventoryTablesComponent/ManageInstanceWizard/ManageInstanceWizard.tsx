import { useWizard, WizardContextProvider, WizardState } from '@netapp/design-system/dist/components/Wizard';
import { BlueXPListeners, postBlueXPMessage, StepLayout, WizardContent, WizardHeader } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styles from './ManageInstanceWizard.module.scss';
import * as DetectInstanceStep from './DetectInstanceStep/DetectInstanceStep';
import * as ManageInstanceStep from './ManageInstanceStep/ManageInstanceStep';
import ManageOnlyWizard from './ManageOnlyWizard';
import { useAppSelector } from '../../../../store/storeHooks';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';
import { isAlreadyDetectedCheck } from './ManageInstanceUtils';

const Wizard = () => {
    const { t } = useTranslation();
    const { stepsMap, currentStep }: any = useWizard();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { Footer: StepFooter, Content: StepContent } = stepsMap[currentStep];
    return (
        <StepLayout>
            <WizardHeader
                className={styles['manage-instance-wizard']}
                title={t('databases.register-flow.register-instance')}
                onExit={() => {
                    setTimeout(() => {
                        dispatch(setLandingFromWizard(true));
                        navigate('../databases/inventory');
                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: {
                                pathname: './inventory',
                                replace: true
                            }
                        });
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
    const { t } = useTranslation();
    const MANAGE_STEPS = [
        { key: 'detect-instance', label: t('databases.register-flow.authenticate'), component: DetectInstanceStep },
        { key: 'manage-instance', label: t('databases.register-flow.prepare'), component: ManageInstanceStep }
    ];

    const stepsMap = Object.fromEntries(MANAGE_STEPS.map(({ key, component }) => [key, component]));
    const stepPaths = {
        regular: MANAGE_STEPS.map(({ label, key }) => ({ label, key }))
    };

    const initialState: Partial<WizardState> = {};
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);
    const isAlreadyDetected = useMemo(
        () => isAlreadyDetectedCheck(manageSingleInstanceData),
        [manageSingleInstanceData]
    );

    return (
        <>
            {isAlreadyDetected && <ManageOnlyWizard />}
            {!isAlreadyDetected && (
                <WizardContextProvider
                    stepsMap={stepsMap}
                    stepPaths={stepPaths}
                    initialStep="detect-instance"
                    initialPath="regular"
                    initialState={initialState}
                >
                    <Wizard />
                </WizardContextProvider>
            )}
        </>
    );
};

export default ManageInstanceWizard;
