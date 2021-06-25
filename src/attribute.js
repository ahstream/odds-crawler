/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function calcAttributes(attributeText, bt) {
  const attributes = createAttributes();
  switch (bt) {
    case config.bt.OU:
      attributes.attribute1 = parseFloat(attributeText);
      break;
    case config.bt.AH:
      attributes.attribute1 = parseFloat(attributeText);
      break;
    case config.bt.CS:
      const goals = attributeText.split(':');
      if (goals.length === 2) {
        attributes.attribute1 = parseInt(goals[0], 10);
        attributes.attribute2 = parseInt(goals[1], 10);
      }
      break;
    case config.bt.HTFT:
      const signs = attributeText.split('/');
      if (signs.length === 2) {
        const sign1 = signs[0];
        const sign2 = signs[1];
        const outcomeHT = convertOutcomeSignToNum(sign1);
        const outcomeFT = convertOutcomeSignToNum(sign2);
        if (outcomeHT > 0 && outcomeFT > 0) {
          attributes.attribute1 = outcomeHT;
          attributes.attribute2 = outcomeFT;
        }
      }
      break;
    case config.bt.EH:
      attributes.attribute1 = parseInt(attributeText, 10);
      break;
    default:
    // do nothing
  }
  return attributes;
}

export function getAttributeText(betFeed) {
  return betFeed.mixedParameterName || betFeed.handicapValue;
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

function createAttributes(attribute1 = null, attribute2 = null) {
  return {
    attribute1,
    attribute2
  };
}
