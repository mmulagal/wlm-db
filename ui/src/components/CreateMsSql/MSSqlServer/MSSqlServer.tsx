import MSSqlAccordions from './MSSqlAccordions';

import CloudFormation from '../CloudFormation/CloudFormation';

import SelectConfig from '../SelectConfig/SelectConfig';

const MSSqlServer = () => {
    return (
        <>
            <SelectConfig />
            {/* setting up Accordions Group here */}
            <MSSqlAccordions />
            {/* Accordions end here */}
            <CloudFormation />
        </>
    );
};

export default MSSqlServer;
