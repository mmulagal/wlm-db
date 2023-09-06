import { Button } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { setIsLoading } from '../../../../store/mssql/msSqlActionSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDeploySqlTemplateMutation } from '../../../../utils/apiService';
import { navigateToCanvas } from '../../../../utils/appConfig';
import { SELECT_CONFIG } from '../../../../utils/appConstants';

const DiscoveryFooter = () => {
    const state = useAppSelector(state => state);
    const dispatch = useDispatch();

    const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
    const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;

    const [deploySqlTemplate] = useDeploySqlTemplateMutation();

    const handleCreate = () => {};

    return (
        <>
            <Button variant="secondary" isThin onClick={() => navigateToCanvas('/')}>
                {SELECT_CONFIG.PREVIOUS}
            </Button>
            <Button isThin onClick={handleCreate}>
                {SELECT_CONFIG.CREATE}
            </Button>
        </>
    );
};

export default DiscoveryFooter;
