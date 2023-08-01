import { Button } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { SELECT_CONFIG } from '../../../utils/appConstants';
import { handleCreateSQLServer } from './createSqlServer';

const MSSqlFooter = () => {
    const state = useAppSelector(state => state.mssqlForm);
    const dispatch = useDispatch();
    const handleCreate = () => {
        handleCreateSQLServer(state, dispatch);
    };
    return (
        <>
            <Button variant="secondary" isThin>
                {SELECT_CONFIG.CANCEL}
            </Button>
            <Button isThin onClick={handleCreate}>
                {SELECT_CONFIG.CREATE}
            </Button>
        </>
    );
};

export default MSSqlFooter;
