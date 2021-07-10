/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const config = require('../config/config.json');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function sportId(name) {
  return config.sport.id[name];
}

export function sportName(id) {
  return config.sport.name[id];
}
