import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const OperatingSystem = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["Windows server 2016"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="5"
        title={
          <div className={CommonStyles.title}>{GENERAL.OPERATING_SYSTEM}</div>
        }
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default OperatingSystem;
