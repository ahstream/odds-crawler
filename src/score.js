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
const sportlib = require('./sport');

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

  // log.debug('parsedScore', parsedScore);

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

  const matchedFinishedResult = result.match(/Final result <\/span><strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^)]*)?\)?<\/p>/i);
  if (matchedFinishedResult) {
    parseFinishedResult(score, sport, matchedFinishedResult);
    return score;
  }

  const matchedAbortedResult = result.match(/<strong>(.*) (awarded|retired|walkover)<\/strong> ?\(?([^)]*)?\)?<\/p>/i);
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
  const additionalTime = someTextOrNull(matchedResult[2]); // 'ET'
  const results = someTextOrNull(matchedResult[3]); // '0:0, 0:0, 0:1'

  score.status = 'finished';
  parseGeneralResult(score, result, additionalTime, results);
}

function parseAbortedResult(score, sport, matchedResult) {
  const actor = matchedResult[1];
  const status = convertStatus(matchedResult[2]); // 'Abandoned'
  const result = null;
  const additionalTime = null;
  const results = someTextOrNull(matchedResult[3]); // '0:0, 0:0, 0:1'

  score.status = status;
  score.actor = actor;
  parseGeneralResult(score, result, additionalTime, results);
}

function parseNotFinishedResult(score, sport, matchedResult) {
  const status = convertStatus(matchedResult[1]); // 'Abandoned'
  const result = someTextOrNull(matchedResult[2]); // '0:1'
  const additionalTime = someTextOrNull(matchedResult[3]); // 'ET'
  const results = someTextOrNull(matchedResult[4]); // '0:0, 0:0, 0:1'

  score.status = status;
  parseGeneralResult(score, result, additionalTime, results);
}

function parseGeneralResult(score, finalResult, additionalTime, subResults) {
  initFinalResult(score, finalResult, additionalTime);
  initSubResult(score, subResults);
  addFinalResult(score);
  addSubResult(score);

  const additionalTimeText = (additionalTime ? ' ' : '') + additionalTime;
  const subResultsText = subResults ? ` (${subResults})` : '';
  score.resultText = `${finalResult}${additionalTimeText}${subResultsText}`;

  log.info(score);

  // initFullTimeResult(score, result, extra);
  // initPartTimeResults(score, subResults);
  // addPartTimeResults(score);
  // addFullTimeResult(score);
}

function initFinalResult(score, resultText, additionalTime) {
  if (!resultText) {
    score.hasFinalScore = false;
    return;
  }
  const resultList = resultText.split(':');
  score.finalResult = {
    homeScore: numericScore(resultList[0]),
    awayScore: numericScore(resultList[1])
  };
  score.hasFinalScore = true;

  score.isOvertime = isOvertime(additionalTime);
  score.isPenalties = isPenalties(additionalTime);

  score.additionalTime = additionalTime;
}

function initSubResult(score, resultText) {
  if (!resultText) {
    score.hasPartTimeScore = false;
    return;
  }

  const matchedData = [...resultText.matchAll(/((\d+)(?:<sup>(\d+)<\/sup>)?:(\d+)(?:<sup>(\d+)<\/sup>)?)/ig)];
  const subResults = [];
  for (const result of matchedData) {
    const homeScore = numericScore(result[2]);
    const homeScore2 = numericScore(result[3]);
    const awayScore = numericScore(result[4]);
    const awayScore2 = numericScore(result[5]);
    const extraScores = createExtraScores(score.sport, homeScore2, awayScore2);
    subResults.push(createResult(homeScore, awayScore, extraScores.homeScore2, extraScores.awayScore2));
  }

  score.subResults = subResults;

  const subResultsParts = getSubResultElements(score);
  score.periods = subResultsParts ? subResultsParts.periods : null;
  score.overtime = subResultsParts ? subResultsParts.overtime : null;
  score.penalties = subResultsParts ? subResultsParts.penalties : null;

  score.hasPeriods = !!score.periods;
  score.hasOvertime = !!score.overtime;
  score.hasPenalties = !!score.penalties;

  score.hasPartTimeScore = score.status === 'finished' && score.hasPeriods;
}

function addFinalResult(score) {
  const ftResult = getFullTimeResultFromSubResults(score.periods);
  const otResult = getFullTimeResultFromSubResults(score.overtime);
  const ptResult = getFullTimeResultFromSubResults(score.penalties);

  if (score.isPenalties || score.isOvertime) {
    // todo: lägg till OTS?
    score.home.FTOT = score.finalResult.homeScore;
    score.away.FTOT = score.finalResult.awayScore;
    score.home.FT = score.hasPeriods ? ftResult.homeScore : null;
    score.away.FT = score.hasPeriods ? ftResult.awayScore : null;
    score.home.OT = score.hasOvertime ? otResult.homeScore : null;
    score.away.OT = score.hasOvertime ? otResult.awayScore : null;
    score.home.PT = score.hasPenalties ? ptResult.homeScore : null;
    score.away.PT = score.hasPenalties ? ptResult.awayScore : null;
  } else {
    score.home.FT = valOrNull(score.finalResult?.homeScore);
    score.away.FT = valOrNull(score.finalResult?.awayScore);
  }

  score.hasFullTimeScore = score.status === 'finished' && score.home.FT !== null && score.away.FT !== null;
}

function addSubResult(score) {
  if (!score.hasPartTimeScore) {
    return;
  }
  const sportId = sportlib.sportId(score.sport);
  switch (sportId) {
    case config.sport.id.soccer:
      score.home.H1 = subResultHomeScore(score, 1);
      score.home.H2 = subResultHomeScore(score, 2);
      score.home.PTS = null;

      score.away.H1 = subResultAwayScore(score, 1);
      score.away.H2 = subResultAwayScore(score, 2);
      score.away.PTS = null;
      break;
    case config.sport.id.tennis:
      score.home.S1 = subResultHomeScore(score, 1);
      score.home.S2 = subResultHomeScore(score, 2);
      score.home.S3 = subResultHomeScore(score, 3);
      score.home.S4 = subResultHomeScore(score, 4);
      score.home.S5 = subResultHomeScore(score, 5);

      score.home.TB1 = subResultHomeScore2(score, 1);
      score.home.TB2 = subResultHomeScore2(score, 2);
      score.home.TB3 = subResultHomeScore2(score, 3);
      score.home.TB4 = subResultHomeScore2(score, 4);
      score.home.TB5 = subResultHomeScore2(score, 5);

      score.home.PTS = score.home.S1 + score.home.S2 + score.home.S3 + score.home.S4 + score.home.S5;

      score.away.S1 = subResultAwayScore(score, 1);
      score.away.S2 = subResultAwayScore(score, 2);
      score.away.S3 = subResultAwayScore(score, 3);
      score.away.S4 = subResultAwayScore(score, 4);
      score.away.S5 = subResultAwayScore(score, 5);

      score.away.TB1 = subResultAwayScore2(score, 1);
      score.away.TB2 = subResultAwayScore2(score, 2);
      score.away.TB3 = subResultAwayScore2(score, 3);
      score.away.TB4 = subResultAwayScore2(score, 4);
      score.away.TB5 = subResultAwayScore2(score, 5);

      score.away.PTS = score.away.S1 + score.away.S2 + score.away.S3 + score.away.S4 + score.away.S5;
      break;
    default:
      throw new CustomError(`Unsupported sportId: ${sportId}, sportName: ${score.sport}`);
  }
}

function getSubResultElements(score) {
  const matchLength = getMatchLength(score.sport);
  if (!matchLength || matchLength.min <= 0) {
    return null;
  }

  const numSubResults = score.subResults.length;
  let minSubResults;
  let numPeriods = 0;
  let numOvertimes = 0;
  let numPenalties = 0;

  if (score.isPenalties) {
    minSubResults = matchLength.max + 1 + 1;
    if (numSubResults < minSubResults) {
      return null;
    }
    numPeriods = matchLength.max;
    numPenalties = 1;
    numOvertimes = numSubResults - numPeriods - numPenalties;
  } else if (score.isOvertime) {
    minSubResults = matchLength.max + 1;
    if (numSubResults < minSubResults) {
      return null;
    }
    numPeriods = matchLength.max;
    numOvertimes = numSubResults - numPeriods;
  } else {
    if (numSubResults < matchLength.min || numSubResults > matchLength.max) {
      return null;
    }
    numPeriods = numSubResults;
  }

  return {
    periods: score.subResults.slice(0, numPeriods),
    overtime: !numOvertimes ? null : score.subResults.slice(numPeriods, numPeriods + numOvertimes),
    penalties: !numPenalties ? null : score.subResults.slice(numPenalties * -1)
  };

}

function getFullTimeResultFromSubResults(subResults) {
  if (!subResults) {
    return null;
  }
  const ftResult = createResult(0, 0, 0, 0);
  subResults.forEach(subResult => {
    ftResult.homeScore += subResult.homeScore;
    ftResult.awayScore += subResult.awayScore;
  });
  return ftResult;
}

function subResultHomeScore(score, nth) {
  return score.subResults === null ? null : valOrNull(score.subResults[nth - 1]?.homeScore);
}

function subResultHomeScore2(score, nth) {
  return score.subResults === null ? null : valOrNull(score.subResults[nth - 1]?.homeScore2);
}

function subResultAwayScore(score, nth) {
  return score.subResults === null ? null : valOrNull(score.subResults[nth - 1]?.awayScore);
}

function subResultAwayScore2(score, nth) {
  return score.subResults === null ? null : valOrNull(score.subResults[nth - 1]?.awayScore2);
}

function getMatchLength(sport) {
  const matchLength = config.matchLength[sport];
  if (Array.isArray(matchLength)) {
    return { min: matchLength[0], max: matchLength[1] };
  }
  if (typeof matchLength === 'number') {
    return { min: matchLength, max: matchLength };
  }
  return { min: -1, max: -1 };
}

function isOvertime(additionalTime) {
  return additionalTime === 'OT' || additionalTime === 'ET';
}

function isPenalties(additionalTime) {
  return additionalTime === 'penalties';
}

// -------------------------------------

function convertStatus(status) {
  switch (status) {
    case 'The match has already started.':
      return 'live';
    default:
      return status.toLowerCase();
  }
}

/*
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
*/

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

/*
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
      score1,
      score2,
      extraScore1: extraScores.home,
      extraScore2: extraScores.away
    };
    results.push(partScore);
  }

  score.results = results;
}
*/

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
    score.parts[`home${ct}`] = result.score1;
    score.parts[`away${ct}`] = result.score2;
    score.parts[`homeExtra${ct}`] = result.extraScore1;
    score.parts[`awayExtra${ct}`] = result.extraScore2;
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
      score.home.PT = score.results[0].score1;
      score.away.PT = score.results[0].score2;
    }
    if (score.results && score.results.length === 2) {
      score.hasPTScore = false;
      score.home.PT = score.results[1].score1;
      score.away.PT = score.results[1].score2;
    }
    if (score.results && score.results.length === 3) {
      score.hasPTScore = true;
      score.parts.home1 = score.results[0].score1;
      score.parts.away1 = score.results[0].score2;
      score.parts.home2 = score.results[1].score1;
      score.parts.away2 = score.results[1].score2;
      score.home.PT = score.results[2].score1;
      score.away.PT = score.results[2].score2;
    }
    if (score.results && score.results.length === 4) {
      score.hasPTScore = true;
      score.parts.home1 = score.results[0].score1;
      score.parts.away1 = score.results[0].score2;
      score.parts.home2 = score.results[1].score1;
      score.parts.away2 = score.results[1].score2;
      score.home.OT = score.results[2].score1;
      score.away.OT = score.results[2].score2;
      score.home.PT = score.results[3].score1;
      score.away.PT = score.results[3].score2;
    }
    if (score.results && score.results.length >= 5) {
      score.hasPTScore = true;
      score.parts.home1 = score.results[0].score1;
      score.parts.away1 = score.results[0].score2;
      score.parts.home2 = score.results[1].score1;
      score.parts.away2 = score.results[1].score2;
      const otScores = createMultiOvertimeScores(score.results, 2, score.results.length - 2);
      score.home.OT = otScores.totalScore1;
      score.away.OT = otScores.totalScore2;
      score.home.OTS = otScores.scores1;
      score.away.OTS = otScores.scores2;
      score.total.OTS = otScores.textScores;
      score.home.PT = score.results[score.results.length - 1].score1;
      score.away.PT = score.results[score.results.length - 1].score2;
    }
  }

  if (score.extra === 'ET') {
    score.isOvertime = true;
    if (score.results && score.results.length < 3) {
      score.hasPTScore = false;
    }
    if (score.results && score.results.length === 3) {
      score.hasPTScore = true;
      score.parts.home1 = score.results[0].score1;
      score.parts.away1 = score.results[0].score2;
      score.parts.home2 = score.results[1].score1;
      score.parts.away2 = score.results[1].score2;
      score.home.OT = score.results[2].score1;
      score.away.OT = score.results[2].score2;
    }
    if (score.results && score.results.length >= 4) {
      score.hasPTScore = true;
      score.parts.home1 = score.results[0].score1;
      score.parts.away1 = score.results[0].score2;
      score.parts.home2 = score.results[1].score1;
      score.parts.away2 = score.results[1].score2;
      const otScores = createMultiOvertimeScores(score.results, 2, score.results.length - 1);
      score.home.OT = otScores.totalScore1;
      score.away.OT = otScores.totalScore2;
      score.home.OTS = otScores.scores1;
      score.away.OTS = otScores.scores2;
      score.total.OTS = otScores.textScores;
    }
  }
}

function someTextOrNull(val) {
  return val && val.length > 0 ? val : null;
}

function valOrNull(val) {
  return typeof val !== 'undefined' ? val : null;
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

export function scopeToScoreSuffix(sc) {
  const scopeKey = config.scShortName[`${sc}`];
  switch (sc) {
    case config.sc.FTOT:
      return 'FTOT';
    case config.sc.FullTime:
      return 'FT';
    case config.sc.Penalties:
      return 'PT';
    default:
      return `H${scopeKey.slice(-1)}`;
  }
}

function createMultiOvertimeScores(results, fromIndex, toIndex) {
  const filteredResults = results.filter((element, index) => index >= fromIndex && index <= toIndex);
  const scores1 = filteredResults.map(x => x.score1);
  const scores2 = filteredResults.map(x => x.score2);
  const textScores = filteredResults.map(x => `${x.score1}-${x.score2}`).join(', ');
  return { scores1, scores2, totalScore1: _.sum(scores1), totalScore2: _.sum(scores2), textScores };
}

function createExtraScores(sport, homeScore, awayScore) {
  switch (sport) {
    case 'tennis':
      return {
        homeScore2: awayScore ? _.max([awayScore + 2, 7]) : homeScore,
        awayScore2: homeScore ? _.max([homeScore + 2, 7]) : awayScore
      };
    default:
      return {
        homeScore2: homeScore,
        awayScore2: awayScore
      };
  }
}

function createHomeAwayScores() {
  return {
    FTOT: null,
    FT: null,
    H1: null,
    H2: null,
    P1: null,
    P2: null,
    P3: null,
    Q1: null,
    Q2: null,
    Q3: null,
    Q4: null,
    S1: null,
    S2: null,
    S3: null,
    S4: null,
    S5: null,
    TB1: null,
    TB2: null,
    TB3: null,
    TB4: null,
    TB5: null,
    I1: null,
    I2: null,
    I3: null,
    I4: null,
    I5: null,
    I6: null,
    I7: null,
    I8: null,
    I9: null,
    OT: null,
    OTS: null,
    PT: null,
    PTS: null
  };
}

function createTotalScores() {
  return {
    FinalResult: null,
    FTOT: null,
    FT: null,
    H1: null,
    H2: null,
    P1: null,
    P2: null,
    P3: null,
    Q1: null,
    Q2: null,
    Q3: null,
    Q4: null,
    S1: null,
    S2: null,
    S3: null,
    S4: null,
    S5: null,
    I1: null,
    I2: null,
    I3: null,
    I4: null,
    I5: null,
    I6: null,
    I7: null,
    I8: null,
    I9: null,
    OT: null,
    OTS: null,
    PT: null
  };
}

function createScore(sport, options = {}) {
  const data = {
    sport,
    status: null,

    finalResult: null,
    subResults: null,
    additionalTime: null,
    actor: null,

    home: createHomeAwayScores(),
    away: createHomeAwayScores(),
    // total: createTotalScores(),

    hasFinalScore: null,
    hasFullTimeScore: null,
    hasPartTimeScore: null,

    isPenalties: false,
    isOvertime: false,

    startTime: null,
    timestamp: null

    /*
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

     */
  };

  return { ...data, ...options };
}

export function createScores(homeScore, awayScore) {
  return {
    _1: homeScore,
    _2: awayScore
  };
}

function createResult(homeScore, awayScore, homeScore2, awayScore2) {
  return {
    homeScore,
    awayScore,
    homeScore2,
    awayScore2
  };
}
