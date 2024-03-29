import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { handleCreateNewSandbox } from './CreateNewSandboxPayload';

const CreateNewSandboxFooter = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const state = useAppSelector(state => state);
    const closeHandler = () => {
        navigate('../databases');
    };

    const handleCreate = () => {
        const payload = handleCreateNewSandbox(state, dispatch);
    };
    return (
        <>
            <>
                <Button isThin onClick={handleCreate} id={'db-create-button'}>
                    {GENERAL.CREATE}
                </Button>
                <Button isThin variant="secondary" onClick={closeHandler}>
                    {GENERAL.CLOSE}
                </Button>
            </>
        </>
    );
};

export default CreateNewSandboxFooter;
