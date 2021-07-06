/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { httpGetAllowedHtmltext } from './provider';

const provider = require('./provider');

const _ = require('lodash');

const config = require('../config/config.json');
const { createLogger } = require('./lib/loggerlib');

const log = createLogger();

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function getScore(match) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/feed/postmatchscore/1-';
  urls.push(`${baseUrl}${match.id}-${decodeURI(match.params.xhash)}.dat?_=${provider.createLongTimestamp()}`);
  urls.push(`${baseUrl}${match.id}-${decodeURI(match.params.xhashf)}.dat?_=${provider.createLongTimestamp()}`);

  const htmltext = await httpGetAllowedHtmltext(urls);

  const reScore = /"d":({[^}]*})/im;
  const scrapedScore = htmltext.match(reScore);
  if (!scrapedScore || scrapedScore.length !== 2) {
    throw new CustomError('Failed to scrape score for match', { urls, scrapedScore, htmltext });
  }

  const parsedScore = JSON.parse(scrapedScore[1]);
  if (parsedScore === undefined || parsedScore.startTime === undefined || parsedScore.result === undefined) {
    throw new CustomError('Failed to JSON parse score for match', { urls, parsedScore, htmltext });
  }

  log.debug('parsedScore', parsedScore);

  const score = parseScore(match.sport, parsedScore.startTime, parsedScore.result, parsedScore['result-alert']);
  if (!score) {
    throw new CustomError('Failed to parse score for match', { urls, parsedScore, htmltext });
  }

  score.startTime = new Date(parsedScore.startTime * 1000);
  score.timestamp = parsedScore.startTime;


  return score;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function parseScore(sport, timestamp, result, resultAlert) {
  const score = createScore(sport, { status: 'scheduled', startTime: new Date(timestamp * 1000), timestamp });

  const matchedFinishedResult = result.match(/Final result <\/span><strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^\)]*)?\)?<\/p>/i);
  if (matchedFinishedResult) {
    parseFinishedResult(score, sport, matchedFinishedResult);
    return score;
  }

  const matchedAbortedResult = result.match(/<strong>(.*) (awarded|retired|walkover)<\/strong> ?\(?([^\)]*)?\)?<\/p>/i);
  if (matchedAbortedResult) {
    parseAbortedResult(score, sport, matchedAbortedResult);
    return score;
  }

  const matchedNotFinishedResult = resultAlert.match(/<p class="result-alert"><span class="bold">(Abandoned|Canceled|Postponed|Interrupted|The match has already started\.) ?<\/span>(?:<strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^\)]*)\)?)?<\/p>/i);
  if (matchedNotFinishedResult) {
    parseNotFinishedResult(score, sport, matchedNotFinishedResult);
    return score;
  }

  return score;
}

function parseFinishedResult(score, sport, matchedResult) {
  const result = matchedResult[1]; // '0:1'
  const extra = matchedResult[2] ?? ''; // 'ET'
  const results = matchedResult[3] ?? ''; // '0:0, 0:0, 0:1'

  score.status = 'finished';
  parseGeneralResult(score, result, extra, results);
}

function parseAbortedResult(score, sport, matchedResult) {
  const actor = matchedResult[1];
  const status = convertStatus(matchedResult[2]); // 'Abandoned'
  const result = null;
  const extra = null;
  const results = textOrNull(matchedResult[3]); // '0:0, 0:0, 0:1'

  score.status = status;
  score.actor = actor;
  parseGeneralResult(score, result, extra, results);
}

function parseNotFinishedResult(score, sport, matchedResult) {
  const status = convertStatus(matchedResult[1]); // 'Abandoned'
  const result = textOrNull(matchedResult[2]); // '0:1'
  const extra = textOrNull(matchedResult[3]); // 'ET'
  const results = textOrNull(matchedResult[4]); // '0:0, 0:0, 0:1'

  score.status = status;
  parseGeneralResult(score, result, extra, results);
}

function parseGeneralResult(score, result, extra, results) {
  initFullTimeResult(score, result, extra);
  initPartTimeResults(score, results);
  addPartTimeResults(score);
  addFullTimeResult(score);
}

function convertStatus(status) {
  switch (status) {
    case 'The match has already started.':
      return 'live';
    default:
      return status.toLowerCase();
  }
}

function initFullTimeResult(score, resultText, extraText) {
  if (!resultText) {
    return;
  }
  const resultList = resultText.split(':');
  score.result = {
    score1: numericScore(resultList[0]),
    score2: numericScore(resultList[1])
  };
  score.extra = extraText;
}

function addFullTimeResult(score) {
  if (score.status !== 'finished') {
    score.hasFTScore = false;
    score.hasFTOTScore = false;
    return;
  }
  if (score.isPenalties || score.isOvertime) {
    score.score1FTOT = score.result.score1;
    score.score2FTOT = score.result.score2;
    score.hasFTOTScore = true;
    if (score.hasPTScore) {
      const ftScores = getFullTimeScoreFromPartTimeScores(score);
      score.score1FT = ftScores.score1;
      score.score2FT = ftScores.score2;
      score.hasFTScore = true;
    } else {
      score.hasFTScore = false;
    }
  } else {
    score.hasFTScore = true;
    score.hasFTOTScore = false;
    score.score1FT = score.result.score1;
    score.score2FT = score.result.score2;
  }
}

function getFullTimeScoreFromPartTimeScores(score) {
  switch (score.sport) {
    case 'soccer':
      return {
        score1: score.score1H1 + score.score1H2,
        score2: score.score1H1 + score.score1H2
      };
    case 'tennis':
      return {
        score1: score.result.score1,
        score2: score.result.score2
      };
    default:
      throw new CustomError('Unsupported sport!', { score });
  }
}


function analyzePartTimeScores(score) {
  if (score.hasPTScore === false) {
    // already set, do nothing!
    return;
  }

  switch (score.sport) {
    case 'soccer':
      score.hasPTScore =
        score.status === 'finished' &&
        score.score1H1 !== null &&
        score.score2H1 !== null &&
        score.score1H2 !== null &&
        score.score2H2 !== null;
      break;
    case 'tennis':
      score.hasPTScore =
        score.status === 'finished' &&
        score.score1H1 !== null &&
        score.score2H1 !== null &&
        score.score1H2 !== null &&
        score.score2H2 !== null;
      break;
    default:
      score.hasPTScore = false;
  }
}

function initPartTimeResults(score, resultsText) {
  if (!resultsText) {
    return;
  }

  const matchedResults = [...resultsText.matchAll(/((\d+)(?:<sup>(\d+)<\/sup>)?:(\d+)(?:<sup>(\d+)<\/sup>)?)/ig)];
  const results = [];
  for (const partResult of matchedResults) {
    const score1 = numericScore(partResult[2]);
    const score2 = numericScore(partResult[4]);
    const extraScore1 = numericScore(partResult[3]);
    const extraScore2 = numericScore(partResult[5]);
    const extraScores = createExtraScores(score.sport, extraScore1, extraScore2);
    const partScore = {
      // matchedText: result[0],
      score1,
      score2,
      extraScore1: extraScores.extraScore1,
      extraScore2: extraScores.extraScore2
    };
    results.push(partScore);
  }

  score.results = results;
}

function createExtraScores(sport, score1, score2) {
  switch (sport) {
    case 'tennis':
      return {
        extraScore1: score2 ? _.max([score2 + 2, 7]) : score1,
        extraScore2: score1 ? _.max([score1 + 2, 7]) : score2
      };
    default:
      return {
        extraScore1: score1,
        extraScore2: score2
      };
  }
}

function addPartTimeResults(score) {
  if (!score.extra) {
    addPartTimeResultsNoOvertime(score);
  } else if (score.sport === 'soccer') {
    addPartTimeResultsOvertimeSoccer(score);
  } else {
    // do nothing!
  }
  analyzePartTimeScores(score);
}

function addPartTimeResultsNoOvertime(score) {
  if (!score.results) {
    return;
  }
  let ct = 1;
  for (const result of score.results) {
    score[`score1H${ct}`] = result.score1;
    score[`score2H${ct}`] = result.score2;
    score[`extraScore1H${ct}`] = result.extraScore1;
    score[`extraScore2H${ct}`] = result.extraScore2;
    ct++;
  }
}

function addPartTimeResultsOvertimeSoccer(score) {
  if (score.extra === 'penalties') {
    score.isPenalties = true;
    if (score.results && score.results.length < 1) {
      score.hasPTScore = false;
    }
    if (score.results && score.results.length === 1) {
      score.hasPTScore = false;
      score.score1PT = score.results[0].score1;
      score.score2PT = score.results[0].score2;
    }
    if (score.results && score.results.length === 2) {
      score.hasPTScore = false;
      score.score1PT = score.results[1].score1;
      score.score2PT = score.results[1].score2;
    }
    if (score.results && score.results.length === 3) {
      score.hasPTScore = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      score.score1PT = score.results[2].score1;
      score.score2PT = score.results[2].score2;
    }
    if (score.results && score.results.length === 4) {
      score.hasPTScore = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      score.score1OT = score.results[2].score1;
      score.score2OT = score.results[2].score2;
      score.score1PT = score.results[3].score1;
      score.score2PT = score.results[3].score2;
    }
    if (score.results && score.results.length >= 5) {
      score.hasPTScore = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      const textScores = createMultiOvertimeScores(score.results, 2, score.results.length - 2);
      score.score1OT = textScores.scores1;
      score.score2OT = textScores.scores2;
      score.score1PT = score.results[score.results.length - 1].score1;
      score.score2PT = score.results[score.results.length - 1].score2;
    }
  }

  if (score.extra === 'ET') {
    score.isOvertime = true;
    if (score.results && score.results.length < 3) {
      score.hasPTScore = false;
    }
    if (score.results && score.results.length === 3) {
      score.hasPTScore = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      score.score1OT = score.results[2].score1;
      score.score2OT = score.results[2].score2;
    }
    if (score.results && score.results.length >= 4) {
      score.hasPTScore = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      const textScores = createMultiOvertimeScores(score.results, 2, score.results.length - 1);
      score.score1OT = textScores.scores1;
      score.score2OT = textScores.scores2;
    }
  }
}

function textOrNull(val) {
  if (val && val.length > 0) {
    return val;
  }
  return null;
}

function numericScore(score) {
  if (!score) {
    return null;
  }
  if (typeof score === 'string') {
    return parseInt(score, 10);
  }
  return score;
}

function createMultiOvertimeScores(results, fromIndex, toIndex) {
  const filteredResults = results.filter((element, index) => index >= fromIndex && index <= toIndex);
  const scores1 = filteredResults.map(x => x.score1);
  const scores2 = filteredResults.map(x => x.score2);
  return { scores1, scores2 };
}

export function scopeToScoreSuffix(sc) {
  const scopeKey = config.scShortName[`${sc}`];
  switch (sc) {
    case config.sc.FTOT:
      return 'FTOT';
    case config.sc.FT:
      return 'FT';
    case config.sc.PT:
      return 'PT';
    default:
      return `H${scopeKey.slice(-1)}`;
  }
}

export function createScores(score1, score2) {
  return {
    _1: score1,
    _2: score2
  };
}

function createScore(sport, options = {}) {
  const data = {
    sport,
    status: null,
    actor: null,
    result: null,
    results: null,
    extra: null,
    hasFTScore: null,
    hasFTOTScore: null,
    hasPTScore: null,
    isPenalties: false,
    isOvertime: false,
    startTime: null,
    timestamp: null,
    score1FT: null,
    score2FT: null,
    score1FTOT: null,
    score2FTOT: null,
    score1H1: null,
    score2H1: null,
    score1H2: null,
    score2H2: null,
    score1H3: null,
    score2H3: null,
    score1H4: null,
    score2H4: null,
    score1H5: null,
    score2H5: null,
    score1OT: null,
    score2OT: null,
    score1PT: null,
    score2PT: null,
    extraScore1H1: null,
    extraScore2H1: null,
    extraScore1H2: null,
    extraScore2H2: null,
    extraScore1H3: null,
    extraScore2H3: null,
    extraScore1H4: null,
    extraScore2H4: null,
    extraScore1H5: null,
    extraScore2H5: null
  };

  return { ...data, ...options };
}
