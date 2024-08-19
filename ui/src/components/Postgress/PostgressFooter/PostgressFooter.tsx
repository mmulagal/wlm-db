import { Button } from '@netapp/design-system';
// import { useProtectBackupMutation } from '../../../utils/apiService';
import { useAppSelector } from '../../../store/storeHooks';
import { useNavigate } from 'react-router-dom';
import { navigateToCanvas } from '../../../utils/appConfig';

function PostgressFooter() {
    const { databaseHostEntryPoint } = useAppSelector(state => state.msSqlAction);
    // const [protectBackup] = useProtectBackupMutation();
    const navigate = useNavigate();

    const protectBackupHandler = async () => {
        // try {
        //     const res = await protectBackup({
        //         payload: {
        //             rowData: selectedRows[0].retention,
        //             protectDbName: selectedPolicyDbName
        //         }
        //     });
        //     console.log(res);
        // } catch {
        //     console.log('error');
        // }
    };

    const handleCancel = () => {
        if (databaseHostEntryPoint === 'database') {
            navigate('/databases');
        } else {
            navigateToCanvas('/');
        }
    };

    return (
        <>
            <Button variant="secondary" isThin onClick={handleCancel}>
                Cancel
            </Button>
            <Button isThin onClick={protectBackupHandler}>
                Create
            </Button>
        </>
    );
}

export default PostgressFooter;
