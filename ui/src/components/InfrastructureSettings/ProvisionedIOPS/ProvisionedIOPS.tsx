import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const ProvisionedIOPS = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["Automatic"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="17"
        title={
          <div className={CommonStyles.title}>{GENERAL.PROVISIONED_IOPS}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default ProvisionedIOPS;
