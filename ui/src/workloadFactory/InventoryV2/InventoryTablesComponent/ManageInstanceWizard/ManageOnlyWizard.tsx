import { Button, Header, StepLayout, WizardContent, WizardFooter, WizardHeader } from '@netapp/design-system';
import { Content } from './ManageInstanceStep/ManageInstanceStep';
import styles from './ManageInstanceWizard.module.scss';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { handleSingleInstanceManage } from './ManageInstanceUtils';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useLazyGetSubTaskListQuery, useManageBulkV2MssqlInstanceMutation } from '../../../../utils/apiService';

const ManageOnlyWizard = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [manageBulkV2InstanceApi] = useManageBulkV2MssqlInstanceMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const manageSingleInstanceChecks = useAppSelector(state => state.inventoryV2.manageSingleInstanceChecks);

    const handleManage = () => {
        handleSingleInstanceManage(
            manageSingleInstanceChecks,
            dispatch,
            manageBulkV2InstanceApi,
            getJobDetailApi,
            navigate
        );
    };
    return (
        <StepLayout>
            <Header
                className={styles['manage-instance-wizard']}
                title={'Register instance'}
                closeButtonProps={{
                    onClick: () => {
                        setTimeout(() => {
                            dispatch(setLandingFromWizard(true));
                            navigate('../databases/inventory');
                        }, 100);
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
                            setTimeout(() => {
                                dispatch(setLandingFromWizard(true));
                                navigate('../databases/inventory');
                            }, 100);
                        }}
                    >
                        Previous
                    </Button>
                    <Button isThin onClick={handleManage} id="wizard-manage-btn">
                        Register
                    </Button>
                </>
            </WizardFooter>
        </StepLayout>
    );
};

export default ManageOnlyWizard;
