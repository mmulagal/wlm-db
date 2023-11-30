import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const Location = ({ handleToggle, openKey }: accordionType) => {
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        AWS account:
                    </Typography>
                    <Typography variant="Regular_14">01234567890123456790</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Region:
                    </Typography>
                    <Typography variant="Regular_14">(us-east-1) | US East, N.Virginia</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Availability Zone 1:
                    </Typography>
                    <Typography variant="Regular_14">us-east-1b</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Subnet 1:
                    </Typography>
                    <Typography variant="Regular_14">10.20.1.0/24</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Availability Zone 2:
                    </Typography>
                    <Typography variant="Regular_14">us-east-1a</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Subnet 2:
                    </Typography>
                    <Typography variant="Regular_14">10.20.1.0/24</Typography>
                </div>
            </>
        );
    };
    return (
        <div className={''}>
            <DbAccordion
                heading="Location"
                toggle={handleToggle}
                open={openKey === 'Location'}
                content={contentArea()}
            />
        </div>
    );
};

export default Location;
