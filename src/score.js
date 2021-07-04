/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { httpGetAllowedHtmltext } from './provider';

const provider = require('./provider');

const _ = require('lodash');

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

  const score = parseScore(match.sport, parsedScore.result, parsedScore['result-alert']);
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

export function parseScore(sport, result, resultAlert) {
  const matchedFinishedResult = result.match(/Final result <\/span><strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^\)]*)?\)?<\/p>/i);
  if (matchedFinishedResult) {
    return parseFinishedResult(sport, matchedFinishedResult);
  }

  const matchedAbortedResult = result.match(/<strong>(.*) (awarded|retired|walkover)<\/strong> ?\(?([^\)]*)?\)?<\/p>/i);
  log.info('matchedAbortedResult', matchedAbortedResult);
  if (matchedAbortedResult) {
    return parseAbortedResult(sport, matchedAbortedResult);
  }

  const matchedNotFinishedResult = resultAlert.match(/<p class="result-alert"><span class="bold">(Abandoned|Canceled|Postponed|Interrupted|The match has already started\.) ?<\/span>(?:<strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^\)]*)\)?)?<\/p>/i);
  log.info('matchedNotFinishedResult', matchedNotFinishedResult);
  if (matchedNotFinishedResult) {
    return parseNotFinishedResult(sport, matchedNotFinishedResult);
  }

  return null;
}

function parseFinishedResult(sport, matchedResult) {
  const matchedText = matchedResult[0];
  const result = matchedResult[1]; // '0:1'
  const extra = matchedResult[2] ?? ''; // 'ET'
  const results = matchedResult[3] ?? ''; // '0:0, 0:0, 0:1'

  const score = createScore(sport);
  score.status = 'finished';
  createFullTimeResult(sport, result, extra, score);
  createPartTimeResults(sport, results, score);
  processPartTimeResults(sport, score);
  analyzeResults(sport, score);

  log.info(score);
  return score;
}

function parseAbortedResult(sport, matchedResult) {
  const matchedText = matchedResult[0];
  const actor = matchedResult[1];
  const reason = convertReason(matchedResult[2]); // 'Abandoned'
  const results = textOrNull(matchedResult[3]); // '0:0, 0:0, 0:1'

  const score = createScore(sport);
  score.status = reason;
  score.actor = actor;
  createPartTimeResults(sport, results, score);
  processPartTimeResults(sport, score);
  analyzeResults(sport, score);

  return score;
}

function parseNotFinishedResult(sport, matchedResult) {
  const matchedText = matchedResult[0];
  const reason = convertReason(matchedResult[1]); // 'Abandoned'
  const result = textOrNull(matchedResult[2]); // '0:1'
  const extra = textOrNull(matchedResult[3]); // 'ET'
  const results = textOrNull(matchedResult[4]); // '0:0, 0:0, 0:1'

  const score = createScore(sport);
  score.status = reason;
  createFullTimeResult(sport, result, extra, score);
  createPartTimeResults(sport, results, score);
  processPartTimeResults(sport, score);
  analyzeResults(sport, score);

  return score;
}

function convertReason(reason) {
  switch (reason) {
    case 'The match has already started.':
      return 'live';
    default:
      return reason.toLowerCase();
  }
}

function createFullTimeResult(sport, resultText, extraText, score) {
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

function analyzeResults(sport, score) {
  if (score.hasPartTimeScores === false) {
    // already set, do nothing!
    return;
  }

  switch (sport) {
    case 'soccer':
      score.hasPartTimeScores =
        score.status === 'finished' &&
        score.score1H1 !== null &&
        score.score2H1 !== null &&
        score.score1H2 !== null &&
        score.score2H2 !== null;
      break;
    case 'tennis':
      score.hasPartTimeScores =
        score.status === 'finished' &&
        score.score1H1 !== null &&
        score.score2H1 !== null &&
        score.score1H2 !== null &&
        score.score2H2 !== null;
      break;
    default:
      score.hasPartTimeScores = false;
  }
}

function createPartTimeResults(sport, resultsText, score) {
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
    const extraScores = handleExtraScores(sport, extraScore1, extraScore2);
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

function handleExtraScores(sport, score1, score2) {
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

function processPartTimeResults(sport, score) {
  if (!score.extra) {
    processPartTimeResultsNoOvertime(score);
    return;
  }
  switch (sport) {
    case 'soccer':
      processPartTimeResultsOvertimeSoccer(score);
      break;
    default:
    // do nothing!
  }
}

function processPartTimeResultsNoOvertime(score) {
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

function processPartTimeResultsOvertimeSoccer(score) {
  if (score.extra === 'penalties') {
    score.isPenalties = true;
    if (score.results && score.results.length < 1) {
      score.hasPartTimeScores = false;
    }
    if (score.results && score.results.length === 1) {
      score.hasPartTimeScores = false;
      score.score1P = score.results[0].score1;
      score.score2P = score.results[0].score2;
    }
    if (score.results && score.results.length === 2) {
      score.hasPartTimeScores = false;
      score.score1P = score.results[1].score1;
      score.score2P = score.results[1].score2;
    }
    if (score.results && score.results.length === 3) {
      score.hasPartTimeScores = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      score.score1P = score.results[2].score1;
      score.score2P = score.results[2].score2;
    }
    if (score.results && score.results.length === 4) {
      score.hasPartTimeScores = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      score.score1OT = score.results[2].score1;
      score.score2OT = score.results[2].score2;
      score.score1P = score.results[3].score1;
      score.score2P = score.results[3].score2;
    }
    if (score.results && score.results.length >= 5) {
      score.hasPartTimeScores = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      const textScores = createMultiOvertimeScores(score.results, 2, score.results.length - 2);
      score.score1OT = textScores.scores1;
      score.score2OT = textScores.scores2;
      score.score1P = score.results[score.results.length - 1].score1;
      score.score2P = score.results[score.results.length - 1].score2;
    }
  }

  if (score.extra === 'ET') {
    score.isOvertime = true;
    if (score.results && score.results.length < 3) {
      score.hasPartTimeScores = false;
    }
    if (score.results && score.results.length === 3) {
      score.hasPartTimeScores = true;
      score.score1H1 = score.results[0].score1;
      score.score2H1 = score.results[0].score2;
      score.score1H2 = score.results[1].score1;
      score.score2H2 = score.results[1].score2;
      score.score1OT = score.results[2].score1;
      score.score2OT = score.results[2].score2;
    }
    if (score.results && score.results.length >= 4) {
      score.hasPartTimeScores = true;
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

function createScore(sport) {
  return {
    sport,
    status: null,
    actor: null,
    result: null,
    results: null,
    extra: null,
    hasPartTimeScores: null,
    isPenalties: false,
    isOvertime: false,
    startTime: null,
    timestamp: null,
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
    score1P: null,
    score2P: null,
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
}

export function createScores(score1, score2) {
  return {
    _1: score1,
    _2: score2
  };
}

export function createScoreOld(options = {}) {
  const data = {
    ok: false,
    status: '',

    hasFullTimeScore: false,
    hasPartTimeScore: false,
    isOT: false,
    isPenalties: false,

    // isFinishedOk: false,
    // isPostponed: false,
    // finalResultOnly: false,

    startTime: null,
    timestamp: null,

    result: null,
    ptScores: null,
    ptResult: null,
    resultAlert: null,

    sc1_1: null, // FTOT
    sc1_2: null,
    sc2_1: null, // FT
    sc2_2: null,

    sc3_1: null, // H1
    sc3_2: null,
    sc4_1: null, // H2
    sc4_2: null,

    /*
    sc5_1: null, // P1
    sc5_2: null,
    sc6_1: null, // P2
    sc6_2: null,
    sc7_1: null, // P3
    sc7_2: null,

    sc8_1: null, // Q1
    sc8_2: null,
    sc9_1: null, // Q2
    sc9_2: null,
    sc10_1: null, // Q3
    sc10_2: null,
    sc11_1: null, // Q4
    sc11_2: null,

    sc12_1: null, // S1
    sc12_2: null,
    sc13_1: null, // S2
    sc13_2: null,
    sc14_1: null, // S3
    sc14_2: null,
    sc15_1: null, // S4
    sc15_2: null,
    sc16_1: null, // S5
    sc16_2: null,
    */

    sc98_1: null, // OT/ET
    sc98_2: null,
    sc99_1: null, // Penalties
    sc99_2: null
  };

  return { ...data, ...options };
}
