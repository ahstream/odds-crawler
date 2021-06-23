// DECLARES -----------------------------------------------------------------------------

const config = require('../../config/config.json');
const { createLogger } = require('../lib/loggerlib');

const log = createLogger();

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function getAttributeText(betFeed) {
  return betFeed.mixedParameterName || betFeed.handicapValue;
}

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
        attributes.attribute1 = parseInt(goals[0]);
        attributes.attribute2 = parseInt(goals[1]);
      }
      break;
    case config.bt.HTFT:
      const signs = attributeText.split('/');
      if (signs.length === 2) {
        const sign1 = signs[0];
        const sign2 = signs[1];
        const outcomeHT =
          sign1 === '1' ? 1 : sign1 === 'X' ? 2 : sign1 === '2' ? 3 : null;
        const outcomeFT =
          sign2 === '1' ? 1 : sign2 === 'X' ? 2 : sign2 === '2' ? 3 : null;
        if (outcomeHT !== null && outcomeFT !== null) {
          attributes.attribute1 = outcomeHT;
          attributes.attribute2 = outcomeFT;
        }
        break;
      }
    case config.bt.EH:
      attributes.attribute1 = parseInt(attributeText);
      break;
    default:
    // do nothing
  }
  return attributes;
}

// HELPER FUNCTIONS -----------------------------------------------------------------------------

function createAttributes(attribute1 = null, attribute2 = null) {
  return {
    attribute1,
    attribute2
  };
}
