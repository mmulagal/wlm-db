import { useAppSelector } from '../../../../store/storeHooks';
import { ACTION_TYPE } from '../../../../utils/consts';
import ManageInstanceWizard from './ManageInstanceWizard';
import RegisterBulkWizard from './RegisterBulkWizard';

const RegisterWizard = () => {
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    return <>{wizardOperationType === ACTION_TYPE.BULK ? <RegisterBulkWizard /> : <ManageInstanceWizard />}</>;
};

export default RegisterWizard;
