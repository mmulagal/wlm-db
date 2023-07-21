import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import ActionRequired from "../../../common/ActionRequired/ActionRequired";

import styles from "./AvailabilityZone.module.scss";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const AvailabilityZone = () => {
  //Set the Header text here
  const setHeader = () => {
    return <ActionRequired />;
  };
  return (
    <div className={styles["availability-zone"]}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="3"
        title={<div className={CommonStyles.title}>Availability zones</div>}
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};
export default AvailabilityZone;
