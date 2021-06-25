/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function countSharp(bookies) {
  let count = 0;
  Object.keys(bookies).forEach((key, _index) => {
    count += countBookies(key, 'isSharp');
  });
  return count;
}

export function countSoft(bookies) {
  let count = 0;
  Object.keys(bookies).forEach((key, _index) => {
    count += countBookies(key, 'isSoft');
  });
  return count;
}

export function countExchange(bookies) {
  let count = 0;
  Object.keys(bookies).forEach((key, _index) => {
    count += countBookies(key, 'isBettingExchange');
  });
  return count;
}

export function countBroker(bookies) {
  let count = 0;
  Object.keys(bookies).forEach((key, _index) => {
    count += countBookies(key, 'isBroker');
  });
  return count;
}

export function countSweden(bookies) {
  let count = 0;
  Object.keys(bookies).forEach((key, _index) => {
    count += countBookies(key, 'isSweden');
  });
  return count;
}

export function countExcluded(bookies) {
  let count = 0;
  Object.keys(bookies).forEach((key, _index) => {
    if (config.bookies[key] === undefined) {
      count++;
    }
  });
  return count;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function countBookies(bookieKey, propertyKey) {
  if (config.bookies[bookieKey] === undefined) {
    return 0;
  }
  if (config.bookies[bookieKey][propertyKey] === undefined) {
    return 0;
  }
  return config.bookies[bookieKey][propertyKey] ? 1 : 0;
}

function createBookie(options = {}) {
  const data = {
    id: null,
    name: null,

    is_active: null,

    is_bookie: null,
    is_exchange: null,
    is_broker: null,

    is_sharp: null,
    is_soft: null,
    is_global: null,
    is_local: null,
    local_country_id: null,
    allowed_in_se: null,

    provider_id: null,
    provider_webName: null,
    provider_webUrl: null,
    provider_active: null,
    provider_isNew: null,
    provider_newTo: null,
    provider_preferredCountryID: null
  };

  return { ...data, ...options };
}
