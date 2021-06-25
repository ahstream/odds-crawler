/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

export class CustomError extends Error {
  constructor(message, data) {
    super(message);
    this.name = 'CustomError';
    this.data = data;
  }
}
