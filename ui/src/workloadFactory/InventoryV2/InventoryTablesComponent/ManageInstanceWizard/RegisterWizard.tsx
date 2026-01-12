import { useAppSelector } from '../../../../store/storeHooks';
import { ACTION_TYPE, DBType } from '../../../../utils/consts';
import ManageInstanceWizard from './ManageInstanceWizard';
import RegisterBulkWizard from './RegisterBulkWizard';
import RegisterNewWizard from './RegisterNewWizard';

const RegisterWizard = () => {
    const { wizardOperationType, manageSingleInstanceData } = useAppSelector(state => state.inventoryV2);
    return (
        <>
            {wizardOperationType === ACTION_TYPE.BULK ? (
                <RegisterBulkWizard />
            ) : manageSingleInstanceData?.hostType !== DBType.MSSQL ? (
                <ManageInstanceWizard />
            ) : (
                <RegisterNewWizard />
            )}
        </>
    );
};

export default RegisterWizard;
