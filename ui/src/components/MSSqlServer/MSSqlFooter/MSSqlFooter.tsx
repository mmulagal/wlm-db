import { Button } from '@netapp/design-system';
import { SELECT_CONFIG } from '../../../utils/appConstants';

const MSSqlFooter = () => {
    return (
        <>
            <Button variant="secondary" isThin>
                {SELECT_CONFIG.CANCEL}
            </Button>
            <Button isThin>{SELECT_CONFIG.CREATE}</Button>
        </>
    );
};

export default MSSqlFooter;
