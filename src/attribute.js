/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function calcAttributes(attribute, bt) {
  const attributes = createAttributes();
  switch (bt) {
    case config.betType['O/U'].id:
      attributes.value1 = parseFloat(attribute);
      break;
    case config.betType.AH.id:
      attributes.value1 = parseFloat(attribute);
      break;
    case config.betType.CS.id:
      const goals = attribute.split(':');
      if (goals.length === 2) {
        attributes.value1 = parseInt(goals[0], 10);
        attributes.value2 = parseInt(goals[1], 10);
      }
      break;
    case config.betType['HT/FT'].id:
      const signs = attribute.split('/');
      if (signs.length === 2) {
        const sign1 = signs[0];
        const sign2 = signs[1];
        const outcomeHT = convertOutcomeSignToNum(sign1);
        const outcomeFT = convertOutcomeSignToNum(sign2);
        if (outcomeHT > 0 && outcomeFT > 0) {
          attributes.value1 = outcomeHT;
          attributes.value2 = outcomeFT;
        }
      }
      break;
    case config.betType.EH.id:
      attributes.value1 = parseInt(attribute, 10);
      break;
    default:
    // do nothing
  }
  return attributes;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function convertOutcomeSignToNum(sign) {
  switch (sign.toUpperCase()) {
    case '1':
      return 1;
    case 'X':
      return 2;
    case '2':
      return 3;
    default:
      return 0;
  }
}

function createAttributes(value1 = null, value2 = null) {
  return {
    value1,
    value2
  };
}
