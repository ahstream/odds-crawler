/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

import { CustomError } from './exceptions';
import { httpGetAllowedHtmltext } from './provider';

const provider = require('./provider');

// ------------------------------------------------------------------------------------------------
// MAIN FUNCTIONS
// ------------------------------------------------------------------------------------------------

export async function parseScore(match) {
  const score = createScore();

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

  // Everything from now are failures that should be handled normally!
  score.ok = true;

  score.startTime = new Date(parsedScore.startTime * 1000);
  score.startTimeUnix = parsedScore.startTime;

  const result = parsedScore.result;
  const resultAlert = parsedScore['result-alert'];

  if (resultAlert !== '') {
    if (resultAlert.match(/.*(Canceled).*/i)) {
      score.status = 'canceled';
      return score;
    }
    if (resultAlert.match(/.*(Postponed).*/i)) {
      score.status = 'postponed';
      return score;
    }
  }

  const ftResult = result.match(/<strong>([0-9]+):([0-9]+)(?: penalties)?( ET)?( OT)?/i);

  if (ftResult == null) {
    if (result.match(/.*(awarded).*/i)) {
      score.status = 'awarded';
      return score;
    }
  } else {
    score.sc1_1 = parseInt(ftResult[1], 10);
    score.sc1_2 = parseInt(ftResult[2], 10);

    // Set FT same as FTOT now, in case PT results are not available!
    score.sc2_1 = score.sc1_1;
    score.sc2_2 = score.sc1_2;

    score.hasFullTimeScore = true;

    const scoreText = ftResult[0];
    score.isOT = scoreText.match(/.*(ET).*/i) !== null;
    score.isPenalties = scoreText.match(/.*(Penalties).*/i) !== null;
  }

  const ptResult = result.match(/\(([0-9]+):([0-9]+)(, ([0-9]+):([0-9]+))*\)/i);

  if (ptResult && ptResult.length >= 1) {
    const ptText = ptResult[0].trim();
    score.ptScores = ptText;
    const ptTextScores = ptText.replaceAll('(', '').replaceAll(')', '').split(',');
    if (ptTextScores.length === 1) {
      // Having only one part time score probably mean match was canceled!?
      score.status = 'unknown';
      return score;
    }
    const ptNumScores = ptTextScores.map((ptTextScore) => {
      const scores = ptTextScore.trim().split(':');
      return [parseInt(scores[0], 10), parseInt(scores[1], 10)];
    });

    score.sc3_1 = ptNumScores[0][0];
    score.sc3_2 = ptNumScores[0][1];
    score.sc4_1 = ptNumScores[1][0];
    score.sc4_2 = ptNumScores[1][1];
    score.sc2_1 = score.sc3_1 + score.sc4_1;
    score.sc2_2 = score.sc3_2 + score.sc4_2;

    if (score.isPenalties || score.isOT) {
      const extraScores = ptNumScores.filter(
        (item, index) => index + 1 > 2 // all results after half1 and half2!
      );
      const numExtraScores = extraScores.length;

      if (score.isOT) {
        const etFinalScore = extraScores.reduce((acc, curr) => [curr[0] + acc[0], curr[1] + acc[1]], [0, 0]);
        score.sc98_1 = etFinalScore[0];
        score.sc98_2 = etFinalScore[1];
      }

      if (score.isPenalties) {
        const ptFinalScore = extraScores[numExtraScores - 1];
        score.sc99_1 = ptFinalScore[0];
        score.sc99_2 = ptFinalScore[1];

        const etScores = extraScores.filter((item, index) => index + 1 < numExtraScores);
        const etFinalScore = etScores.reduce((acc, curr) => [curr[0] + acc[0], curr[1] + acc[1]], [0, 0]);
        score.sc98_1 = etFinalScore[0];
        score.sc98_2 = etFinalScore[1];
      }
    }

    score.hasPartTimeScore = true;
  }

  if (score.status !== '') {
    // do nothing, keep current status
  } else if (parsedScore.isFinished) {
    score.status = 'finished';
  } else if (!parsedScore.isStarted) {
    score.status = 'scheduled';
  } else if (parsedScore.isStarted) {
    score.status = 'live';
  }

  return score;
}

// ------------------------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------------------------

export function createScores(score1, score2) {
  return {
    _1: score1,
    _2: score2
  };
}

export function createScore(options = {}) {
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
    startTimeUnix: null,

    ptScores: null,

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
