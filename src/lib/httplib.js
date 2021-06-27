/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

const axios = require('axios');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function get(url, config = {}) {
  return axios.get(url, config);
}

export async function getResponse(url, config = {}) {
  try {
    return await axios.get(url, config);
  } catch (error) {
    return handleError(error);
  }
}

export async function getMany(urls, maxTries = 2, delayBetweenTries = 100, config = {}) {
  const results = urls.map((url, index) => ({
    index,
    url,
    success: false,
    response: null
  }));

  let allFetched = false;
  let tries = 0;

  while (allFetched === false && tries < maxTries) {
    tries++;

    const promises = [];
    urls.forEach((url, index) => {
      const hasAlreadyBeenFetched = results.find((item) => item.index === index).success;
      if (hasAlreadyBeenFetched) {
        promises.push(Promise.resolve(null));
      } else {
        promises.push(get(url, config));
      }
    });

    const responses = await Promise.all(promises);

    let numSuccess = 0;
    responses.forEach((response, index) => {
      if (results.find((item) => item.index === index).success) {
        // Already fetched successful response in previous attempt!
        numSuccess++;
        return;
      }
      const url = urls[index];
      results[index].response = response;
      if (isSuccess(response, '')) {
        numSuccess++;
        results[index].success = true;
      }
    });

    if (numSuccess === results.length) {
      allFetched = true;
      break;
    }

    if (delayBetweenTries > 0) await sleep(delayBetweenTries);
  }

  const finalResults = results.map((item) => ({
    success: item.success,
    url: item.url,
    response: item.response
  }));

  const allSuccess = finalResults.map((item) => item.success).reduce((sum, val) => sum && val, true);

  return { success: allSuccess, data: finalResults };
}

export function isSuccess(response, url = '') {
  const successFlag = response.data && response.status && response.status >= 200 && response.status <= 300;

  if (url !== '' && response && response.request && response.request.res) {
    const isSameUrl = url === response.request.res.responseUrl;
    return successFlag && isSameUrl;
  }

  return successFlag;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

function handleError(error) {
  if (error.response) {
    // The request was made and the server responded with a status code that falls out of the range of 2xx
    return error.response;
  }
  if (error.request) {
    // The request was made but no response was received, `error.request` is an instance of XMLHttpRequest in the
    // browser and an instance of http.ClientRequest in Node.js
    return error.request;
  }
  // Something happened in setting up the request and triggered an Error
  console.error(error.message);
  return error;
}

function sleep(ms, randomizeMin = 100, randomizeMax = 100) {
  const randomizeFactor = randomizeMin - randomizeMax;
  const msVal = randomizeFactor ? ((getRandomIntInclusive(randomizeMin, randomizeMax) / 100) * ms).toFixed(0) : ms;
  return new Promise((resolve) => setTimeout(resolve, msVal));
}

function getRandomIntInclusive(min, max) {
  const minCeil = Math.ceil(min);
  const maxFloor = Math.floor(max);
  return Math.floor(Math.random() * (maxFloor - minCeil + 1) + minCeil);
}
