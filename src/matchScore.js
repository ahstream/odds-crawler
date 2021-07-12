/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { httpGetAllowedHtmltext, createLongTimestamp } from './provider';
import { getMinMaxMatchLength } from './sport';

const _ = require('lodash');

const { createLogger } = require('./lib/loggerlib');
const scorelib = require('./score');

const log = createLogger();

// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function getMatchScore(match) {
  const urls = [];
  const baseUrl = 'https://fb.oddsportal.com/feed/postmatchscore/1-';
  urls.push(`${baseUrl}${match.id}-${decodeURI(match.params.xhash)}.dat?_=${createLongTimestamp()}`);
  urls.push(`${baseUrl}${match.id}-${decodeURI(match.params.xhashf)}.dat?_=${createLongTimestamp()}`);

  const htmltext = await httpGetAllowedHtmltext(urls);

  const reScore = /"d":({[^}]*})/im;
  const scrapedScore = htmltext.match(reScore);
  if (!scrapedScore || scrapedScore.length !== 2) {
    throw new CustomError('Failed to scrape matchScore for match', { urls, scrapedScore, htmltext });
  }

  const parsedScore = JSON.parse(scrapedScore[1]);
  if (parsedScore === undefined || parsedScore.startTime === undefined || parsedScore.result === undefined) {
    throw new CustomError('Failed to JSON parse matchScore for match', { urls, parsedScore, htmltext });
  }

  const matchScore = parseMatchScore(match.sportName, parsedScore.startTime, match.params.home, match.params.away, parsedScore.result, parsedScore['result-alert']);
  if (!matchScore) {
    throw new CustomError('Failed to parse matchScore for match', { urls, parsedScore, htmltext });
  }

  matchScore.startTime = new Date(parsedScore.startTime * 1000);
  matchScore.timestamp = parsedScore.startTime;

  // log.debug('matchScore', matchScore);

  return matchScore;
}

// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function parseMatchScore(sportName, timestamp, homeTeam, awayTeam, result, resultAlert) {
  const matchScore = createMatchScore(sportName, {
    startTime: new Date(timestamp * 1000),
    timestamp,
    homeTeam,
    awayTeam
  });

  if (!result && !resultAlert) {
    matchScore.status = 'scheduled';
    matchScore.type = 'scheduled';
    return matchScore;
  }

  const matchedFinishedFinalResultData = result.match(/Final result <\/span><strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^)]*)?\)?<\/p>/i);
  if (matchedFinishedFinalResultData) {
    parseFinishedFinalResult(matchScore, sportName, matchedFinishedFinalResultData);
    return matchScore;
  }

  const matchedPostponedFinalResultData = result.match(/<strong>(.*) (awarded|retired|walkover)<\/strong> ?\(?([^)]*)?\)?<\/p>/i);
  if (matchedPostponedFinalResultData) {
    parsePostponedFinalResult(matchScore, sportName, matchedPostponedFinalResultData);
    return matchScore;
  }

  const matchedNonFinalResultData = resultAlert.match(/<p class="result-alert"><span class="bold">(Abandoned|Canceled|Postponed|Interrupted|The match has already started\.) ?<\/span>(?:<strong>(\d+:\d+) ?([^<]*)<\/strong> ?\(?([^\)]*)\)?)?<\/p>/i);
  if (matchedNonFinalResultData) {
    parseNonFinalResult(matchScore, sportName, matchedNonFinalResultData);
    return matchScore;
  }

  return matchScore;
}

function parseFinishedFinalResult(matchScore, sportName, matchedData) {
  const result = matchedData[1] || ''; // '0:1'
  const additionalTime = parseAdditionalTime(matchedData[2] || ''); // 'ET'
  const results = matchedData[3] || ''; // '0:0, 0:0, 0:1'

  parseGeneralResult(matchScore, 'finished', '', result, additionalTime, results);
}

function parsePostponedFinalResult(matchScore, sportName, matchedData) {
  const actor = matchedData[1] || '';  // 'Liverpool'
  const status = convertStatus(matchedData[2] || ''); // 'retired'
  const results = matchedData[3] || ''; // '0:0, 0:0, 0:1'

  parseGeneralResult(matchScore, status, actor, '', '', results);
}

function parseNonFinalResult(matchScore, sportName, matchedData) {
  const status = convertStatus(matchedData[1] || ''); // 'Abandoned'
  const result = matchedData[2] || ''; // '0:1'
  const additionalTime = parseAdditionalTime(matchedData[3] || ''); // 'ET'
  const results = matchedData[4] || ''; // '0:0, 0:0, 0:1'

  parseGeneralResult(matchScore, status, '', result, additionalTime, results);
}

function parseGeneralResult(matchScore, status, actor, finalResult, additionalTime, subResults) {
  matchScore.status = status;
  matchScore.actor = actor;

  initFinalResult(matchScore, finalResult, additionalTime);
  initSubResult(matchScore, subResults);
  addFinalResult(matchScore);
  addSubResult(matchScore);
  finalizeMatchScore(matchScore);

  // log.verbose(matchScore);
}

export function parseAdditionalTime(value) {
  const matchedData = value.match(/(OT|ET|penalties)/i);
  if (matchedData && matchedData[1]) {
    return matchedData[1];
  }
  return '';
}

function finalizeMatchScore(matchScore) {
  matchScore.scoreText = calcScoreText(matchScore);

  const finalResultWinner = getFinalResultWinner(matchScore);
  const awardedWinner = getAwardedWinner(matchScore);

  switch (matchScore.status) {
    case 'finished':
      matchScore.type = 'finished';
      matchScore.finalResultWinner = finalResultWinner;
      matchScore.fullTimeResultWinner = getFullTimeResultWinner(matchScore);
      matchScore.hasFinalResult = hasFinalResult(matchScore);
      matchScore.hasFullTimeResult = hasFullTimeResult(matchScore);
      matchScore.resultText = createResultText(finalResultWinner, matchScore.scoreText);
      break;
    case 'canceled':
      matchScore.type = 'canceled';
      matchScore.finalResultWinner = '';
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = false;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText('canceled');
      break;
    case 'awarded':
      matchScore.type = 'awarded';
      matchScore.finalResultWinner = awardedWinner;
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = true;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText(`${awardedWinner} awarded`, matchScore.scoreText);
      break;
    case 'retired':
      matchScore.type = 'awarded';
      matchScore.finalResultWinner = awardedWinner;
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = true;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText(`${getAwardedLoser(matchScore)} retired`, matchScore.scoreText);
      break;
    case 'walkover':
      matchScore.type = 'awarded';
      matchScore.finalResultWinner = awardedWinner;
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = true;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText(`${awardedWinner} walkover`, matchScore.scoreText);
      break;
    case 'postponed':
      matchScore.type = 'postponed';
      matchScore.finalResultWinner = '';
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = false;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText('postponed', matchScore.scoreText);
      break;
    case 'abandoned':
      matchScore.type = 'postponed';
      matchScore.finalResultWinner = '';
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = false;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText('abandoned', matchScore.scoreText);
      break;
    case 'interrupted':
      matchScore.type = 'postponed';
      matchScore.finalResultWinner = '';
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = false;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText('interrupted', matchScore.scoreText);
      break;
    case 'live':
      matchScore.type = 'live';
      matchScore.finalResultWinner = '';
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = false;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = createResultText('live', matchScore.scoreText);
      break;
    case 'scheduled':
      matchScore.type = 'scheduled';
      matchScore.finalResultWinner = '';
      matchScore.fullTimeResultWinner = '';
      matchScore.hasFinalResult = false;
      matchScore.hasFullTimeResult = false;
      matchScore.hasPartTimeResult = false;
      matchScore.resultText = '';
      break;
    default:
      log.error('Unexpected matchScore status:', matchScore);
      break;
  }
}

function initFinalResult(matchScore, resultText, additionalTime) {
  const scores = resultText?.split(':');
  if (scores && scores.length === 2) {
    matchScore.finalResult = scorelib.createScore(toNumericScore(scores[0]), toNumericScore(scores[1]));
    matchScore.isOvertime = isOvertime(additionalTime);
    matchScore.isPenalties = isPenalties(additionalTime);
    matchScore.additionalTime = additionalTime;
  }
}

function initSubResult(matchScore, resultText) {
  if (!resultText) {
    return;
  }

  const matchedData = [...resultText.matchAll(/((\d+)(?:<sup>(\d+)<\/sup>)?:(\d+)(?:<sup>(\d+)<\/sup>)?)/ig)];
  const subResults = [];
  for (const result of matchedData) {
    const home = toNumericScore(result[2]);
    const homeTB = toNumericScore(result[3]);
    const away = toNumericScore(result[4]);
    const awayTB = toNumericScore(result[5]);
    subResults.push(scorelib.createScore(home, away, homeTB, awayTB));
  }

  matchScore.subResults = subResults;

  const subResultParts = getSubResultParts(matchScore);
  matchScore.periods = subResultParts?.periods || [];
  matchScore.overtime = subResultParts?.overtime || [];
  matchScore.penalties = subResultParts?.penalties || [];

  matchScore.hasPartTimeResult = matchScore.periods.length > 0;
  matchScore.hasOvertime = matchScore.overtime.length > 0;
  matchScore.hasPenalties = matchScore.penalties.length > 0;
}

function addFinalResult(matchScore) {
  const fullTimeResult = calcResultFromSubResult(matchScore.periods);
  const overtimeResult = calcResultFromSubResult(matchScore.overtime);
  const penaltiesResult = calcResultFromSubResult(matchScore.penalties);

  if (matchScore.isPenalties || matchScore.isOvertime) {
    matchScore.scores.FTOT = matchScore.finalResult;
    matchScore.scores.FT = matchScore.hasPartTimeResult ? fullTimeResult : null;
    matchScore.scores.OT = matchScore.hasOvertime ? overtimeResult : null;
    matchScore.scores.PT = matchScore.hasPenalties ? penaltiesResult : null;
  } else {
    matchScore.scores.FT = matchScore.finalResult;
  }
}

function addSubResult(matchScore) {
  if (!matchScore.hasPartTimeResult) {
    return;
  }

  switch (matchScore.sportName) {
    case 'snooker':
      matchScore.scores.PTS = null;
      break;
    case 'soccer':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'handball':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'pesapallo':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'rugby-league':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'rugby-union':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'futsal':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'bandy':
      matchScore.scores.H1 = getSubResult(matchScore, 1);
      matchScore.scores.H2 = getSubResult(matchScore, 2);
      matchScore.scores.PTS = null;
      break;
    case 'basketball':
      matchScore.scores.Q1 = getSubResult(matchScore, 1);
      matchScore.scores.Q2 = getSubResult(matchScore, 2);
      matchScore.scores.Q3 = getSubResult(matchScore, 3);
      matchScore.scores.Q4 = getSubResult(matchScore, 4);
      matchScore.scores.H1 = scorelib.add([matchScore.scores.Q1, matchScore.scores.Q2]);
      matchScore.scores.H2 = scorelib.add([matchScore.scores.Q3, matchScore.scores.Q4]);
      matchScore.scores.PTS = null;
      break;
    case 'american-football':
      matchScore.scores.Q1 = getSubResult(matchScore, 1);
      matchScore.scores.Q2 = getSubResult(matchScore, 2);
      matchScore.scores.Q3 = getSubResult(matchScore, 3);
      matchScore.scores.Q4 = getSubResult(matchScore, 4);
      matchScore.scores.H1 = scorelib.add([matchScore.scores.Q1, matchScore.scores.Q2]);
      matchScore.scores.H2 = scorelib.add([matchScore.scores.Q3, matchScore.scores.Q4]);
      matchScore.scores.PTS = null;
      break;
    case 'hockey':
      matchScore.scores.P1 = getSubResult(matchScore, 1);
      matchScore.scores.P2 = getSubResult(matchScore, 2);
      matchScore.scores.P3 = getSubResult(matchScore, 3);
      matchScore.scores.PTS = null;
      break;
    case 'floorball':
      matchScore.scores.P1 = getSubResult(matchScore, 1);
      matchScore.scores.P2 = getSubResult(matchScore, 2);
      matchScore.scores.P3 = getSubResult(matchScore, 3);
      matchScore.scores.PTS = null;
      break;
    case 'tennis':
      matchScore.scores.S1 = getSubResult(matchScore, 1);
      matchScore.scores.S2 = getSubResult(matchScore, 2);
      matchScore.scores.S3 = getSubResult(matchScore, 3);
      matchScore.scores.S4 = getSubResult(matchScore, 4);
      matchScore.scores.S5 = getSubResult(matchScore, 5);
      matchScore.scores.PTS = scorelib.add([matchScore.scores.S1, matchScore.scores.S2, matchScore.scores.S3, matchScore.scores.S4, matchScore.scores.S5]);
      break;
    case 'volleyball':
      matchScore.scores.S1 = getSubResult(matchScore, 1);
      matchScore.scores.S2 = getSubResult(matchScore, 2);
      matchScore.scores.S3 = getSubResult(matchScore, 3);
      matchScore.scores.S4 = getSubResult(matchScore, 4);
      matchScore.scores.S5 = getSubResult(matchScore, 5);
      matchScore.scores.PTS = scorelib.add([matchScore.scores.S1, matchScore.scores.S2, matchScore.scores.S3, matchScore.scores.S4, matchScore.scores.S5]);
      break;
    case 'badminton':
      matchScore.scores.S1 = getSubResult(matchScore, 1);
      matchScore.scores.S2 = getSubResult(matchScore, 2);
      matchScore.scores.S3 = getSubResult(matchScore, 3);
      matchScore.scores.PTS = scorelib.add([matchScore.scores.S1, matchScore.scores.S2, matchScore.scores.S3]);
      break;
    case 'beach-volleyball':
      matchScore.scores.S1 = getSubResult(matchScore, 1);
      matchScore.scores.S2 = getSubResult(matchScore, 2);
      matchScore.scores.S3 = getSubResult(matchScore, 3);
      matchScore.scores.PTS = scorelib.add([matchScore.scores.S1, matchScore.scores.S2, matchScore.scores.S3]);
      break;
    default:
      throw new CustomError(`Unsupported sport: ${matchScore.sportName}`);
  }
}

function getSubResultParts(matchScore) {
  const matchLength = getMinMaxMatchLength(matchScore.sportName);
  if (!matchLength || matchLength.min <= 0) {
    return null;
  }

  const numSubResults = matchScore.subResults.length;
  let minSubResults;
  let numPeriods = 0;
  let numOvertimes = 0;
  let numPenalties = 0;

  if (matchScore.isPenalties) {
    minSubResults = matchLength.max + 1; // ok with penalties with no overtime!
    if (numSubResults < minSubResults) {
      return null;
    }
    numPeriods = matchLength.max;
    numPenalties = 1;
    numOvertimes = numSubResults - numPeriods - numPenalties;
  } else if (matchScore.isOvertime) {
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
    periods: matchScore.subResults.slice(0, numPeriods),
    overtime: !numOvertimes ? null : matchScore.subResults.slice(numPeriods, numPeriods + numOvertimes),
    penalties: !numPenalties ? null : matchScore.subResults.slice(numPenalties * -1)
  };

}

function calcResultFromSubResult(subResultList) {
  if (!subResultList) {
    return null;
  }
  return scorelib.add(subResultList);
}

function getSubResult(matchScore, nth) {
  return matchScore.subResults?.length < nth ? null : valueOrNull(matchScore.subResults[nth - 1]);
}

function isOvertime(additionalTime) {
  return additionalTime === 'OT' || additionalTime === 'ET';
}

function isPenalties(additionalTime) {
  return additionalTime === 'penalties';
}

function hasFinalResult(matchScore) {
  return typeof matchScore.finalResult?.home === 'number' && typeof matchScore.finalResult?.away === 'number';
}

function hasFullTimeResult(matchScore) {
  return typeof matchScore.scores.FT?.home === 'number' && typeof matchScore.scores.FT?.away === 'number';
}

function getFinalResultWinner(matchScore) {
  const homeScore = typeof matchScore.finalResult?.home === 'number' ? matchScore.finalResult?.home : -1;
  const awayScore = typeof matchScore.finalResult?.away === 'number' ? matchScore.finalResult?.away : -1;
  if (homeScore < 0) {
    return '';
  }
  if (homeScore > awayScore) {
    return 'home';
  }
  if (homeScore < awayScore) {
    return 'away';
  }
  if (homeScore === awayScore) {
    return 'draw';
  }

  return 'error';
}

function getFullTimeResultWinner(matchScore) {
  if (matchScore.isOvertime || matchScore.isPenalties) {
    return 'draw';
  }

  const homeScore = typeof matchScore.scores.FT?.home === 'number' ? matchScore.scores.FT?.home : -1;
  const awayScore = typeof matchScore.scores.FT?.away === 'number' ? matchScore.scores.FT?.away : -1;
  if (homeScore < 0) {
    return '';
  }
  if (homeScore > awayScore) {
    return 'home';
  }
  if (homeScore < awayScore) {
    return 'away';
  }
  if (homeScore === awayScore) {
    return 'draw';
  }

  return 'error';
}

function getAwardedWinner(matchScore) {
  switch (matchScore.status) {
    case 'awarded':
      // Winner = name of awarded actor!
      if (matchScore.actor === matchScore.homeTeam) {
        return 'home';
      }
      if (matchScore.actor === matchScore.awayTeam) {
        return 'away';
      }
      log.error('Unexpected awarded winner:', matchScore);
      return '';
    case 'retired':
      // Winner = name of not retired actor!
      if (matchScore.actor === matchScore.homeTeam) {
        return 'away';
      }
      if (matchScore.actor === matchScore.awayTeam) {
        return 'home';
      }
      log.error('Unexpected awarded winner:', matchScore);
      return '';
    case 'walkover':
      // Winner = name of actor!
      if (matchScore.actor === matchScore.homeTeam) {
        return 'home';
      }
      if (matchScore.actor === matchScore.awayTeam) {
        return 'away';
      }
      log.error('Unexpected awarded winner:', matchScore);
      return '';
    default:
      return '';
  }
}

function getAwardedLoser(matchScore) {
  const awardedWinner = getAwardedWinner(matchScore);
  if (awardedWinner === 'home') {
    return 'away';
  }
  if (awardedWinner === 'away') {
    return 'home';
  }
  return '';
}

function calcScoreText(matchScore) {
  let scoreText = '';
  if (matchScore.finalResult) {
    scoreText += `${matchScore.finalResult.home}:${matchScore.finalResult.away} ${matchScore.additionalTime}`.trim();
  }

  if (!matchScore.subResults) {
    return scoreText;
  }

  const scoreTexts = [];
  matchScore.subResults.forEach(subResult => {
    const minTiebreakPoints = _.min([subResult.homeMeta, subResult.awayMeta]);
    const tiebreakPoints = minTiebreakPoints > 0 ? `[${minTiebreakPoints}]` : '';
    scoreTexts.push(`${subResult.home}:${subResult.away}${tiebreakPoints}`);
  });

  scoreText += ` (${scoreTexts.join(', ')})`;

  return scoreText.trim();
}

function createResultText(action, scoreText = '') {
  return `${action}${scoreText ? ` at ${scoreText}` : ''}`;
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

function valueOrNull(val) {
  return typeof val !== 'undefined' ? val : null;
}

function toNumericScore(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return parseInt(value, 10);
  }
  return value;
}

function createMatchScore(sportName, options = {}) {
  const data = {
    sportName,
    status: '',
    type: '',
    finalResultWinner: '',
    fullTimeResultWinner: '',
    hasFinalResult: false,
    hasFullTimeResult: false,
    hasPartTimeResult: false,
    scoreText: '',
    resultText: '',

    finalResult: null,
    subResults: null,
    additionalTime: '',
    actor: '',

    homeTeam: '',
    awayTeam: '',

    startTime: null,
    timestamp: null,
    isPenalties: false,
    isOvertime: false,
    periods: [],
    overtime: [],
    penalties: [],

    scores: {
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
    }
  };

  return { ...data, ...options };
}
