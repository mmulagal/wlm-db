import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const ISConnectivity = ({ handleToggle, openKey }: accordionType) => {
    const resourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.VPC_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.vpcId}</Typography>
                </div>
                {resourceDetails?.storage?.fsxn?.protocol && (
                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {GENERAL.ACCESS_PROTOCOL}
                        </Typography>
                        <Typography variant="Regular_14">
                            {resourceDetails?.storage?.fsxn?.protocol?.join(',')}
                        </Typography>
                    </div>
                )}
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
