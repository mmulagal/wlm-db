import { AccordionController, Typography } from "@netapp/design-system";
import { GENERAL } from "../../utils/appConstants";

import DatabaseCredentials from "./DatabaseCredentials/DatabaseCredentials";
import DatabaseDeploymentModel from "./DatabaseDeploymentModel/DatabaseDeploymentModel";
import DatabaseEdition from "./DatabaseEdition/DatabaseEdition";
import DatabaseName from "./DatabaseName/DatabaseName";
import DatabaseVersion from "./DatabaseVersion/DatabaseVersion";
import License from "./License/License";
import OperatingSystem from "./OperatingSystem/OperatingSystem";

import styles from "./ApplicationSettings.module.scss";
import CommonStyles from "../../utils/CommonStyles.module.scss";

const ApplicationSettings = () => {
  return (
    <div className={CommonStyles["accordion-group"]}>
      <AccordionController isGrouped>
        <Typography
          style={{
            padding: "0 0 8px",
          }}
          variant="Semibold_16"
        >
          {GENERAL.APPLICATION_SETTINGS}
        </Typography>

        {/* Application settings accordions */}
        <OperatingSystem />
        <DatabaseDeploymentModel />
        <DatabaseEdition />
        <DatabaseVersion />
        <License />
        <DatabaseName />
        <DatabaseCredentials />
        {/* Ends here */}
      </AccordionController>
    </div>
  );
};

export default ApplicationSettings;
