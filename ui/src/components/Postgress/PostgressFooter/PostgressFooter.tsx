import { Button } from '@netapp/design-system';
// import { useProtectBackupMutation } from '../../../utils/apiService';
import { useAppSelector } from '../../../store/storeHooks';

function PostgressFooter() {
    // const [protectBackup] = useProtectBackupMutation();

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
    return (
        <>
            <Button variant="secondary" isThin onClick={() => {}}>
                Cancel
            </Button>
            <Button isThin onClick={protectBackupHandler}>
                Create
            </Button>
        </>
    );
}

export default PostgressFooter;
