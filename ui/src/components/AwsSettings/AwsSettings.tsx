import { AccordionController, Typography } from "@netapp/design-system";
import AwsAccount from "./AwsAccount/AwsAccount";
import styles from "./AwsSettings.module.scss";

const AwsSettings = () => {
  return (
    <div className={styles["aws-settings"]}>
      <AccordionController isGrouped>
        <Typography
          style={{
            padding: "0 0 16px",
          }}
          variant="Semibold_16"
        >
          AWS settings
        </Typography>
        {/* AWS Accounts Accordion */}
        <AwsAccount />
      </AccordionController>
    </div>
  );
};

export default AwsSettings;
