// DECLARES -----------------------------------------------------------------------------

/* eslint-disable no-extend-native */
/* eslint-disable func-names */
/* eslint-disable import/prefer-default-export */

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function isValidUrl(url) {
  try {
    const temp = new URL(url);
  } catch (e) {
    return false;
  }
  return true;
}

export function trimCharsLeft(str, chars) {
  return str.replace(new RegExp(`^[${chars}]+`), '');
}

export function trimCharsRight(str, chars) {
  return str.replace(new RegExp(`[${chars}]+$`), '');
}

export function trimChars(str, chars) {
  return trimCharsLeft(trimCharsRight(str, chars), chars);
}

export function ensureProperties(baseObj, properties) {
  let obj = baseObj;
  if (typeof obj === 'undefined') {
    throw new Error('Base object cannot be undefined!');
  }
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    if (typeof obj[property] === 'undefined') {
      obj[property] = {};
    }
    obj = obj[property];
  }
}

export function propertiesExists(baseObj, properties) {
  let obj = baseObj;
  if (typeof obj === 'undefined') {
    return false;
  }
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    obj = obj[property];
    if (typeof obj === 'undefined') {
      return false;
    }
  }
  return true;
}

export function capitalize(words) {
  return words
    .split(' ')
    .map((w) => w.substring(0, 1).toUpperCase() + w.substring(1))
    .join(' ');
}

export function convertNumberValToLocaleString(val, locale = 'sv_SE') {
  if (typeof val !== 'number') {
    return val;
  }
  if (locale === 'sv_SE') {
    return val.toString().replace(/\./g, ',');
  }
  return val.toString();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRandomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function decodeEntitiesInString(encodedString) {
  const translateRegexp = /&(nbsp|amp|quot|lt|gt);/g;
  const translate = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>'
  };
  return encodedString
    .replace(translateRegexp, (match, entity) => translate[entity])
    .replace(/&#(\d+);/gi, (match, numStr) => {
      const num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}

export function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
