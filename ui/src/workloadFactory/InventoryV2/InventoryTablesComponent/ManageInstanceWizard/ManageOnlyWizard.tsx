import { Button, Header, StepLayout, WizardContent, WizardFooter, WizardHeader } from '@netapp/design-system';
import { Content } from './ManageInstanceStep/ManageInstanceStep';
import styles from './ManageInstanceWizard.module.scss';
import { useNavigate } from 'react-router-dom';

const ManageOnlyWizard = () => {
    const navigate = useNavigate();

    const handleManage = () => {};
    return (
        <StepLayout>
            <Header
                className={styles['manage-instance-wizard']}
                title={'Manage instance'}
                closeButtonProps={{
                    onClick: () => {
                        navigate('../databases/inventory');
                    }
                }}
            />
            <WizardContent
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <Content />
            </WizardContent>
            <WizardFooter>
                <>
                    <Button
                        variant="secondary"
                        isThin
                        onClick={() => {
                            navigate('../databases/inventory');
                        }}
                    >
                        Previous
                    </Button>
                    <Button isThin onClick={handleManage} id="wizard-manage-btn">
                        Manage
                    </Button>
                </>
            </WizardFooter>
        </StepLayout>
    );
};

export default ManageOnlyWizard;
