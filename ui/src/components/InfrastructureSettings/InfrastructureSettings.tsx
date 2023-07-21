import { AccordionController, Typography } from "@netapp/design-system";
import { GENERAL } from "../../utils/appConstants";

import CommonStyles from "../../utils/CommonStyles.module.scss";
import Encryption from "./Encryption/Encryption";
import FSxNSystem from "./FSXNSystem/FSxNSystem";
import InstanceType from "./InstanceType/InstanceType";
import ProvisionedIOPS from "./ProvisionedIOPS/ProvisionedIOPS";
import SimpleNotificationService from "./SimpleNotificationService/SimpleNotificationService";
import StorageCapacity from "./StorageCapacity/StorageCapacity";
import Tags from "./Tags/Tags";
import ThroughputCapacity from "./ThroughputCapacity/ThroughputCapacity";

const InfrastructureSettings = () => {
  return (
    <div className={CommonStyles["accordion-group"]}>
      <AccordionController isGrouped>
        <Typography
          style={{
            padding: "0 0 8px",
          }}
          variant="Semibold_16"
        >
          {GENERAL.INFRASTRUCTURE_SETTINGS}
        </Typography>

        {/* Infra settings accordions */}
        <InstanceType />
        <FSxNSystem />
        <StorageCapacity />
        <ProvisionedIOPS />
        <ThroughputCapacity />
        <Encryption />
        <Tags />
        <SimpleNotificationService />
        {/* Ends here */}
      </AccordionController>
    </div>
  );
};

export default InfrastructureSettings;
