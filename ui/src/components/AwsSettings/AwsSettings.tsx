import { AccordionController, Button, Typography } from "@netapp/design-system";

import { GENERAL } from "../../utils/appConstants";
import AvailabilityZone from "./AvailabilityZone/AvailabilityZone";
import AwsAccount from "./AwsAccount/AwsAccount";
import RegionVpc from "./RegionVpc/RegionVpc";
import SecurityGroup from "./SecurityGroup/SecurityGroup";

import styles from "./AwsSettings.module.scss";
import CommonStyles from "../../utils/CommonStyles.module.scss";

const AwsSettings = () => {
  return (
    <div
      className={`${styles["aws-settings"]} ${CommonStyles["accordion-group"]}`}
    >
      <AccordionController isGrouped>
        <div className={styles["header-buttons"]}>
          <Typography
            style={{
              padding: "0 0 8px",
            }}
            variant="Semibold_16"
          >
            {GENERAL.AWS_SETTINGS}
          </Typography>
          <Button Component="button" variant="text">
            {GENERAL.VIEW_API_REQUEST}
          </Button>
        </div>
        {/* AWS Accounts Accordion */}
        <AwsAccount />
        <RegionVpc />
        <AvailabilityZone />
        <SecurityGroup />
      </AccordionController>
    </div>
  );
};

export default AwsSettings;
