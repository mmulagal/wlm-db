import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const DatabaseDeploymentModel = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["Failover Cluster Instances (FCI)"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="6"
        title={
          <div className={CommonStyles.title}>
            {GENERAL.DATABASE_DEPLOYMENT_MODEL}
          </div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default DatabaseDeploymentModel;
