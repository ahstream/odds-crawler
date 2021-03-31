'use strict';

// DECLARES -----------------------------------------------------------------------------

/* eslint-disable no-extend-native */
/* eslint-disable func-names */
/* eslint-disable import/prefer-default-export */

const fs = require('fs');

// EXPORTED FUNCTIONS -----------------------------------------------------------------------------

export function isValidUrl(url) {
  try {
    new URL(url);
  } catch (e) {
    return false;
  }
  return true;
}

export function trimLeftChars(str, charlist) {
  return str.replace(new RegExp('^[' + charlist + ']+'), '');
}

export function trimRightChars(str, charlist) {
  return str.replace(new RegExp('[' + charlist + ']+$'), '');
}

export function trimBothChars(str, charlist) {
  return trimLeftChars(trimRightChars(str, charlist), charlist);
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
  if ((locale = 'sv_SE')) {
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
  var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
  var translate = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    lt: '<',
    gt: '>'
  };
  return encodedString
    .replace(translate_re, function (match, entity) {
      return translate[entity];
    })
    .replace(/&#(\d+);/gi, function (match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
}

export function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
