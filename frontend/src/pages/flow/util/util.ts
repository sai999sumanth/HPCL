import computerGreen from "../../assets/flow/computer-green.png";
import computerOrange from "../../assets/flow/computer-orange.png";

import hooterGreen from "../../assets/flow/hooter-green.png";
import hooterOrange from "../../assets/flow/hooter-orange.png";
import hooterRed from "../../assets/flow/hooter-red.png";

import rosovGreen from "../../assets/flow/rosov-green.png";
import rosovOrange from "../../assets/flow/rosov-orange.png";
import rosovRed from "../../assets/flow/rosov-red.png";

import vftGreen from "../../assets/flow/vft-green.png";
import vftOrange from "../../assets/flow/vft-orange.png";
import vftRed from "../../assets/flow/vft-red.png";

import esdGreen from "../../assets/flow/esd-green.png";
import esdOrange from "../../assets/flow/esd-orange.png";
import esdRed from "../../assets/flow/esd-red.png";

import jockeyGreen from "../../assets/flow/jockey-pump-green.png";
import jockeyOrange from "../../assets/flow/jockey-pump-orange.png";
import jockeyRed from "../../assets/flow/jockey-pump-red.png";

import pthGreen from "../../assets/flow/pt-hydrant-green.png";
import pthOrange from "../../assets/flow/pt-hydrant-orange.png";
import pthRed from "../../assets/flow/pt-hydrant-red.png";

import feGreen from "../../assets/flow/fire-engine-green.png";
import feOrange from "../../assets/flow/fire-engine-orange.png";
import feRed from "../../assets/flow/fire-engine-red.png";

import raderGreen from "../../assets/flow/radar-green.png";
import radarOrange from "../../assets/flow/radar-orange.png";
import radarRed from "../../assets/flow/radar-red.png";

import pumpsGreen from "../../assets/flow/pumps-green.png";
import pumpsOrange from "../../assets/flow/pumps-orange.png";
import pumpsRed from "../../assets/flow/pumps-red.png";

import compressorGreen from "../../assets/flow/compressor-green.png";
import compressorOrange from "../../assets/flow/compressor-orange.png";
import compressorRed from "../../assets/flow/compressor-red.png";

import bgGateGreen from "../../assets/flow/barrier-gate-green.png";
import bgGateOrange from "../../assets/flow/barrier-gate-orange.png";
import bgGateRed from "../../assets/flow/barrier-gate-red.png";

import gantryGreen from "../../assets/flow/gantry-green.png";
import gantryOrange from "../../assets/flow/gantry-orange.png";
import gantryRed from "../../assets/flow/gantry-red.png";

import mfmGreen from "../../assets/flow/mfm-green.png";
import mfmOrange from "../../assets/flow/mfm-orange.png";
import mfmRed from "../../assets/flow/mfm-red.png";

import dykeGreen from "../../assets/flow/dyke-green.png";
import dykeOrange from "../../assets/flow/dyke-orange.png";
import dykeRed from "../../assets/flow/dyke-red.png";

import plcGreen from "../../assets/flow/plc-green.png";
import plcOrange from "../../assets/flow/plc-orange.png";

import upsGreen from "../../assets/flow/ups-green.png";

export const statusColors = {
  green: "bg-[#1ce918]",
  online: "1ce918",
  standby: "ff8000",
  red: "bg-[#ff0000]",
  orange: "bg-[#ff8000]",
  grey: "bg-[#808080]",
};

export const getLrcaIcon = (status) => {
  switch (status) {
    case "online":
      return computerGreen;
    case "slave":
      return computerOrange;
    case "standby":
      return computerOrange;
    default:
      return computerGreen;
  }
};

export const getHooterIcon = (status) => {
  switch (status) {
    case "green":
      return hooterGreen;
    case "orange":
      return hooterOrange;
    case "red":
      return hooterRed;
    default:
      return hooterGreen;
  }
};

export const getDykeIcon = (status) => {
  switch (status) {
    case "green":
      return dykeGreen;
    case "orange":
      return dykeOrange;
    case "red":
      return dykeRed;
    default:
      return dykeGreen;
  }
};

export const getVftIcon = (status) => {
  switch (status) {
    case "green":
      return vftGreen;
    case "orange":
      return vftOrange;
    case "red":
      return vftRed;
    default:
      return vftGreen;
  }
};

export const getPlcIcon = (status) => {
  // switch (status) {
  //   case "online":
  //     return plcGreen;
  //   case "standby":
  //     return plcOrange;
  //   default:
  //     return plcGreen;
  // }
    return plcGreen;
};

export const getMfmIcon = (status) => {
  switch (status) {
    case "green":
      return mfmGreen;
    case "orange":
      return mfmOrange;
    case "red":
      return mfmRed;
    default:
      return mfmGreen;
  }
};

export const getRadarIcon = (status) => {
  switch (status) {
    case "green":
      return raderGreen;
    case "orange":
      return radarOrange;
    case "red":
      return radarRed;
    default:
      return raderGreen;
  }
};

export const getPumpsIcon = (status) => {
  switch (status) {
    case "green":
      return pumpsGreen;
    case "orange":
      return pumpsOrange;
    case "red":
      return pumpsRed;
    default:
      return pumpsGreen;
  }
};
export const getCompressorIcon = (status) => {
  switch (status) {
    case "green":
      return compressorGreen;
    case "orange":
      return compressorOrange;
    case "red":
      return compressorRed;
    default:
      return compressorGreen;
  }
};
export const getBarrierGateIcon = (status) => {
  switch (status) {
    case "green":
      return bgGateGreen;
    case "orange":
      return bgGateOrange;
    case "red":
      return bgGateRed;
    default:
      return bgGateGreen;
  }
};

export const getGantryBcuIcon = (status) => {
  switch (status) {
    case "green":
      return gantryGreen;
    case "orange":
      return gantryOrange;
    case "red":
      return gantryRed;
    default:
      return gantryGreen;
  }
};

export const getEsdIcon = (status) => {
  switch (status) {
    case "green":
      return esdGreen;
    case "orange":
      return esdOrange;
    case "red":
      return esdRed;
    default:
      return esdGreen;
  }
};

export const getJockeyPumpIcon = (status) => {
  switch (status) {
    case "green":
      return jockeyGreen;
    case "orange":
      return jockeyOrange;
    case "red":
      return jockeyRed;
    default:
      return jockeyGreen;
  }
};

export const getPtHydrantIcon = (status) => {
  switch (status) {
    case "green":
      return pthGreen;
    case "orange":
      return pthOrange;
    case "red":
      return pthRed;
    default:
      return pthGreen;
  }
};
export const getFireEngineIcon = (status) => {
  switch (status) {
    case "green":
      return feGreen;
    case "orange":
      return feOrange;
    case "red":
      return feRed;
    default:
      return feGreen;
  }
};

export const getRosovIcon = (status) => {
  switch (status) {
    case "green":
      return rosovGreen;
    case "orange":
      return rosovOrange;
    case "red":
      return rosovRed;
    default:
      return rosovGreen;
  }
};

export const getUpsIcon = () => {
  return upsGreen;
};

export const getColorForIcon = (faulty = 0, maintanance = 0) => {
  if (faulty === 0 && maintanance === 0) {
    return "green"; // green
  } else if (faulty === 0 && maintanance > 0) {
    return "orange"; // yellow
  } else if (maintanance === 0 && faulty > 0) {
    return "red"; // red
  } else if (maintanance > 0 && faulty > 0) {
    return "red"; // red
  } else {
    return "green"; //grey
  }
};
