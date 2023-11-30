import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const ISConnectivity = ({ handleToggle, openKey }: accordionType) => {
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Key pair name:
                    </Typography>
                    <Typography variant="Regular_14">01234567890123456790</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        VPC:
                    </Typography>
                    <Typography variant="Regular_14">VPC</Typography>
                </div>
            </>
        );
    };
    return (
        <div className={''}>
            <DbAccordion
                heading="Connectivity"
                toggle={handleToggle}
                open={openKey === 'Connectivity'}
                content={contentArea()}
            />
        </div>
    );
};

export default ISConnectivity;
