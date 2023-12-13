import MSSqlAccordions from './MSSqlAccordions';

import CloudFormation from '../CloudFormation/CloudFormation';

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
            {!isWorkloadFactory && <CloudFormation />}
        </>
    );
};

export default MSSqlServer;
