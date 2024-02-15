import { Button } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';

const CreateNewUserFooter = () => {
    const navigate = useNavigate();
    const closeHandler = () => {
        navigate('../databases');
    };
    return (
        <>
            <Button isThin onClick={() => {}}>
                {'Create'}
            </Button>
            <Button isThin variant="secondary" onClick={closeHandler}>
                {'Close'}
            </Button>
        </>
    );
};

export default CreateNewUserFooter;
