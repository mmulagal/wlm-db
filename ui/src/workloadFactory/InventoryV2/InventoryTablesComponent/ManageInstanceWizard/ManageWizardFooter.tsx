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

    const { ontapUserNameFromWizard, ontapPasswordFromWizard, mssqlUserNameFromWizard, mssqlPasswordFromWizard } =
        state;

    const dispatch = useDispatch();

    const goBack = () => {
        gotoPreviousStep();
    };
    const goForward = () => {
        setState({ hitNext: true });
        const noError =
            ontapUserNameFromWizard &&
            ontapUserNameFromWizard.length > 0 &&
            ontapPasswordFromWizard &&
            ontapPasswordFromWizard.length > 0 &&
            mssqlUserNameFromWizard &&
            mssqlUserNameFromWizard.length > 0 &&
            mssqlPasswordFromWizard &&
            mssqlPasswordFromWizard.length > 0;
        if (noError) {
            goToNextStep();
        }
    };

    const handleManage = () => {
        //state is having all payload data
        console.log(state);
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
