import MSSqlAccordions from './MSSqlAccordions';

import SelectConfig from '../SelectConfig/SelectConfig';
import { useAppSelector } from '../../../store/storeHooks';
import { WIZARD_TYPE } from '../../../utils/consts';

const MSSqlServer = () => {
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    return (
        <>
            <SelectConfig wizardType={WIZARD_TYPE.MSSQL} />
            {/* setting up Accordions Group here */}
            <MSSqlAccordions />
            {isWorkloadFactory && <div style={{ marginBottom: '32px' }} />}
            {/* Accordions end here */}
        </>
    );
};

export default MSSqlServer;
