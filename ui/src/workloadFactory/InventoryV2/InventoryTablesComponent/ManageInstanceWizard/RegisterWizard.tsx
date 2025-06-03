import { useAppSelector } from '../../../../store/storeHooks';
import ManageInstanceWizard from './ManageInstanceWizard';
import RegisterBulkWizard from './RegisterBulkWizard';

const RegisterWizard = () => {
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    return <>{wizardOperationType === 'bulk' ? <RegisterBulkWizard /> : <ManageInstanceWizard />}</>;
};

export default RegisterWizard;
