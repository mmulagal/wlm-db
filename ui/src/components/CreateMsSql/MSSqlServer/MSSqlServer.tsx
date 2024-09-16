import MSSqlAccordions from './MSSqlAccordions';

import SelectConfig from '../SelectConfig/SelectConfig';
import { useAppSelector } from '../../../store/storeHooks';

const MSSqlServer = () => {
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    return (
        <>
            <SelectConfig />
            {/* setting up Accordions Group here */}
            <MSSqlAccordions />
            {isWorkloadFactory && <div style={{ marginBottom: '32px' }} />}
            {/* Accordions end here */}
        </>
    );
};

export default MSSqlServer;
