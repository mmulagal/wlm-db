import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const Location = ({ handleToggle, openKey }: accordionType) => {
    const { resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        AWS account:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.awsAccount}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Region:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.region}</Typography>
                </div>

                {resourceDetails?.topology?.ec2Details.length && (
                    <>
                        <div className={commonStyles.row}>
                            <Typography variant="Semibold_14" className={commonStyles.heading}>
                                Availability Zone 1:
                            </Typography>
                            <Typography variant="Regular_14">
                                {resourceDetails.topology.ec2Details[0].availabilityZone}
                            </Typography>
                        </div>

                        <div className={commonStyles.row}>
                            <Typography variant="Semibold_14" className={commonStyles.heading}>
                                Subnet 1:
                            </Typography>
                            <Typography variant="Regular_14">
                                {resourceDetails.topology.ec2Details[0].subnetId}
                            </Typography>
                        </div>
                    </>
                )}

                {resourceDetails?.topology?.ec2Details.length > 1 && (
                    <>
                        <div className={commonStyles.row}>
                            <Typography variant="Semibold_14" className={commonStyles.heading}>
                                Availability Zone 2:
                            </Typography>
                            <Typography variant="Regular_14">
                                {resourceDetails.topology.ec2Details[1].availabilityZone}
                            </Typography>
                        </div>

                        <div className={commonStyles.row}>
                            <Typography variant="Semibold_14" className={commonStyles.heading}>
                                Subnet 2:
                            </Typography>
                            <Typography variant="Regular_14">
                                {resourceDetails.topology.ec2Details[1].subnetId}
                            </Typography>
                        </div>
                    </>
                )}
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
