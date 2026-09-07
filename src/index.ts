import "dotenv/config";

import { startApi } from "./core/App";
import logger from "./core/global/utils/logger";

startApi().catch((error) => {
  logger.fatal({ err: error }, "API process failed to start");
  process.exit(1);
});
