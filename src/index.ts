import { API } from "homebridge";

import { PLATFORM_NAME } from "./settings";
import { HKPlatform } from "./HKPlatform";

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, HKPlatform);
};
