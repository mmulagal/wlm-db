import { Button } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { useDeploySqlTemplateMutation } from '../../../utils/apiService';
import { cmNavigateTo } from '../../../utils/appConfig';
import { SELECT_CONFIG } from '../../../utils/appConstants';
import { handleCreateSQLServer } from './createSqlServer';


const MSSqlFooter = () => {
    const state = useAppSelector(state => state);
    const dispatch = useDispatch();

    const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
    const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;

    const [deploySqlTemplate] = useDeploySqlTemplateMutation();

    const handleCreate = () => {
        const payload = handleCreateSQLServer(state, dispatch);
        if(payload){
            dispatch(setIsLoading(true));
            deploySqlTemplate({credentialId: selectedCredId, region: selectedRegionCode, payload: payload})
            .then((data:any) => {
                dispatch(setIsLoading(false));
                if(!data?.error){
                    cmNavigateTo('/');
                }
            })
            .catch((error:any) => {
                dispatch(setIsLoading(false));
            })
        }
    };

    return (
        <>
            <Button variant="secondary" isThin onClick={() => cmNavigateTo('/')}>
                {SELECT_CONFIG.CANCEL}
            </Button>
            <Button isThin onClick={handleCreate}>
                {SELECT_CONFIG.CREATE}
            </Button>
        </>
    );
};

export default MSSqlFooter;
