import { DsButton, useWizard, WizardFooter } from '@netapp/design-system';
import styles from './ManageInstanceWizard.module.scss';
import { useDispatch } from 'react-redux';

type PlanningWizardFooterProps = {
    style?: React.CSSProperties;
    validation?: () => boolean;
    nextButtonProps?: any;
};

const ManageWizardFooter = (props: PlanningWizardFooterProps) => {
    const { nextButtonProps, validation, style } = props; //onClick must be taken out otherwise will override footer onClick when spread to button
    const { onClick, ...rest } = nextButtonProps ?? { onClick: null };
    const { currentStepIndex, currentStep, gotoPreviousStep, goToNextStep, state, setState }: any = useWizard();

    const dispatch = useDispatch();

    const goBack = () => {
        gotoPreviousStep();
    };
    const goForward = () => {
        const noError = validation ? validation() : true;
        if (noError) {
            if (onClick) {
                // onClick();
                goToNextStep();
            } else goToNextStep();
        }
    };

    const handleManage = () => {
        // dispatch(setPlan(state)); //keep the plan in the store for deployment phase
    };

    return (
        <WizardFooter className={styles['pw-footer']} style={style}>
            {currentStepIndex !== 0 && (
                <DsButton
                    data-testid={`wlm-db-manage-wizard-back-${currentStep}`}
                    isThin={true}
                    onClick={goBack}
                    variant={'secondary'}
                >
                    Previous
                </DsButton>
            )}
            {currentStepIndex < 1 && (
                <DsButton
                    data-testid={`wlm-db-manage-wizard-next-${currentStep}`}
                    isThin={true}
                    onClick={goForward}
                    variant={'primary'}
                    {...rest}
                >
                    Next
                </DsButton>
            )}
            {currentStepIndex === 1 && (
                <DsButton
                    data-testid={`wlm-db-manage-wizard-manage-${currentStep}`}
                    isThin={true}
                    onClick={handleManage}
                    variant={'primary'}
                    {...rest}
                >
                    Manage
                </DsButton>
            )}
        </WizardFooter>
    );
};

export default ManageWizardFooter;
