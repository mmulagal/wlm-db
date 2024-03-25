import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { GENERAL } from '../../../../utils/appConstants';

const CreateNewSandboxFooter = () => {
    const navigate = useNavigate();
    const closeHandler = () => {
        navigate('../databases');
    };
    return (
        <>
            <>
                <Button isThin onClick={() => {}} id={'db-create-button'}>
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
