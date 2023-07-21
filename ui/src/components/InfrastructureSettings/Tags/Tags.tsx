import { AccordionCard, AccordionCardContent } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import CommonStyles from "../../../utils/CommonStyles.module.scss";

const Tags = () => {
  //Set the Header text here
  const setHeader = () => {
    return ["0 Tags"];
  };
  return (
    <div className={""}>
      <AccordionCard
        ValueContent={() => (
          <div className={CommonStyles["heading-content"]}>{setHeader()}</div>
        )}
        id="20"
        title={<div className={CommonStyles.title}>{GENERAL.TAGS}</div>}
      >
        <AccordionCardContent>Content here</AccordionCardContent>
      </AccordionCard>
    </div>
  );
};

export default Tags;
