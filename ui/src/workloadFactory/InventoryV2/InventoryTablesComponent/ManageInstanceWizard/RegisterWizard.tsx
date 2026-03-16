import { useAppSelector } from '../../../../store/storeHooks';
import { ACTION_TYPE } from '../../../../utils/consts';
import RegisterBulkWizard from './RegisterBulkWizard';
import RegisterNewWizard from './RegisterNewWizard';

const RegisterWizard = () => {
    const { wizardOperationType, manageSingleInstanceData } = useAppSelector(state => state.inventoryV2);
    return <>{wizardOperationType === ACTION_TYPE.BULK ? <RegisterBulkWizard /> : <RegisterNewWizard />}</>;
};

export default RegisterWizard;
