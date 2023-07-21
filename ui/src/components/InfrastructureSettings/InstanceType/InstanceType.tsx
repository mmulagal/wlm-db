import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const InstanceType = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["m5-xlarge"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="14"
        title={
          <div className={CommonStyles.title}>{GENERAL.INSTANCE_TYPE}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default InstanceType;
