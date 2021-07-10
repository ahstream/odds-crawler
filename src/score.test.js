import { parseScore } from './score';

const _ = require('lodash');

test('parseScore0()', () => {
  let ps;
  const TIMESTAMP = 1625544525;

  // TENNIS: NotFinishedResult -----------------------------------------------------------------------------------------

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Canceled</span></p>');
  expect(ps.status).toEqual('canceled');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);
  expect(ps.startTime.getTime()).toEqual(TIMESTAMP * 1000);
  expect(ps.timestamp).toEqual(TIMESTAMP);

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">The match has already started.</span></p>');
  expect(ps.status).toEqual('live');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Interrupted </span><strong>0:0</strong> (2:4)</p>');
  expect(ps.status).toEqual('interrupted');
  expect(ps.result).toEqual({ score1: 0, score2: 0 });
  expect(ps.extra).toEqual(null);
  expect(ps.results).toEqual([
    { score1: 2, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.score1H1).toEqual(2);
  expect(ps.score2H1).toEqual(4);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  // TENNIS: AbortedResult  --------------------------------------------------------------------------------------------

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Aney J. walkover</strong></p>', '');
  expect(ps.actor).toEqual('Aney J.');
  expect(ps.status).toEqual('walkover');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Agabigun S. retired</strong> (6:4, 6<sup>9</sup>:7, 1:4)</p>', '');
  expect(ps.actor).toEqual('Agabigun S.');
  expect(ps.status).toEqual('retired');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual([
    { score1: 6, score2: 4, extraScore1: null, extraScore2: null },
    { score1: 6, score2: 7, extraScore1: 9, extraScore2: 11 },
    { score1: 1, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.score1H1).toEqual(6);
  expect(ps.score2H1).toEqual(4);
  expect(ps.score1H2).toEqual(6);
  expect(ps.score2H2).toEqual(7);
  expect(ps.score1H3).toEqual(1);
  expect(ps.score2H3).toEqual(4);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  // TENNIS: FinishedResult  -------------------------------------------------------------------------------------------

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>0:2</strong> (0:6, 6<sup>2</sup>:7)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 0, score2: 2 });
  expect(ps.extra).toEqual('');
  expect(ps.results).toEqual([
    { score1: 0, score2: 6, extraScore1: null, extraScore2: null },
    { score1: 6, score2: 7, extraScore1: 2, extraScore2: 7 }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.score1H1).toEqual(0);
  expect(ps.score2H1).toEqual(6);
  expect(ps.score1H2).toEqual(6);
  expect(ps.score2H2).toEqual(7);
  expect(ps.extraScore1H1).toEqual(null);
  expect(ps.extraScore2H1).toEqual(null);
  expect(ps.extraScore1H2).toEqual(2);
  expect(ps.extraScore2H2).toEqual(7);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(0);
  expect(ps.score2FT).toEqual(2);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  // SOCCER: NotFinishedResult -----------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Abandoned </span><strong>1:0</strong> (1:0)</p>');
  expect(ps.status).toEqual('abandoned');
  expect(ps.result).toEqual({ score1: 1, score2: 0 });
  expect(ps.extra).toEqual(null);
  expect(ps.results).toEqual([
    { score1: 1, score2: 0, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.score1H1).toEqual(1);
  expect(ps.score2H1).toEqual(0);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Canceled</span></p>');
  expect(ps.status).toEqual('canceled');
  expect(ps.result).toEqual(null);
  expect(ps.extra).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Postponed</span></p>');
  expect(ps.status).toEqual('postponed');
  expect(ps.result).toEqual(null);
  expect(ps.extra).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">The match has already started.</span></p>');
  expect(ps.status).toEqual('live');
  expect(ps.result).toEqual(null);
  expect(ps.extra).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  // SOCCER: AbortedResult  --------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Asteras Vlachioti awarded</strong></p>', '');
  expect(ps.actor).toEqual('Asteras Vlachioti');
  expect(ps.status).toEqual('awarded');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Parnu JK Vaprus awarded</strong> (0:0, 0:1)</p>', '');
  expect(ps.actor).toEqual('Parnu JK Vaprus');
  expect(ps.status).toEqual('awarded');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual([
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 0, score2: 1, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.score1H1).toEqual(0);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(0);
  expect(ps.score2H2).toEqual(1);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  // SOCCER: FinishedResult  -------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>0:2</strong></p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 0, score2: 2 });
  expect(ps.extra).toEqual('');
  expect(ps.results).toEqual(null);
  expect(ps.hasPTScore).toEqual(false);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(0);
  expect(ps.score2FT).toEqual(2);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>7:0</strong> (7:0)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 7, score2: 0 });
  expect(ps.extra).toEqual('');
  expect(ps.results).toEqual([{ score1: 7, score2: 0, extraScore1: null, extraScore2: null }]);
  expect(ps.hasPTScore).toEqual(false);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(7);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(null);
  expect(ps.score2H2).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(7);
  expect(ps.score2FT).toEqual(0);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>2:1</strong> (1:0, 1:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 2, score2: 1 });
  expect(ps.extra).toEqual('');
  expect(ps.results).toEqual([
    { score1: 1, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 1, score2: 1, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(1);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(1);
  expect(ps.score2H2).toEqual(1);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(2);
  expect(ps.score2FT).toEqual(1);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  // SOCCER: Overtime --------------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong></p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 4, score2: 5 });
  expect(ps.extra).toEqual('ET');
  expect(ps.results).toEqual(null);
  expect(ps.hasPTScore).toEqual(false);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(true);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(4);
  expect(ps.score2FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 4, score2: 5 });
  expect(ps.extra).toEqual('ET');
  expect(ps.results).toEqual([
    { score1: 1, score2: 0, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(false);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(true);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(4);
  expect(ps.score2FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0, 3:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 4, score2: 5 });
  expect(ps.extra).toEqual('ET');
  expect(ps.results).toEqual([
    { score1: 1, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 3, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(false);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(true);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(4);
  expect(ps.score2FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0, 3:4, 0:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 4, score2: 5 });
  expect(ps.extra).toEqual('ET');
  expect(ps.results).toEqual([
    { score1: 1, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 3, score2: 4, extraScore1: null, extraScore2: null },
    { score1: 0, score2: 1, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(true);
  expect(ps.score1H1).toEqual(1);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(3);
  expect(ps.score2H2).toEqual(4);
  expect(ps.score1OT).toEqual(0);
  expect(ps.score2OT).toEqual(1);
  expect(ps.score1PT).toEqual(null);
  expect(ps.score2PT).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(4);
  expect(ps.score2FT).toEqual(4);
  expect(ps.score1FTOT).toEqual(4);
  expect(ps.score2FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0, 3:4, 0:0, 0:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 4, score2: 5 });
  expect(ps.extra).toEqual('ET');
  expect(ps.results).toEqual([
    { score1: 1, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 3, score2: 4, extraScore1: null, extraScore2: null },
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 0, score2: 1, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.isPenalties).toEqual(false);
  expect(ps.isOvertime).toEqual(true);
  expect(ps.score1H1).toEqual(1);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(3);
  expect(ps.score2H2).toEqual(4);
  expect(ps.score1OT).toEqual([0, 0]);
  expect(ps.score2OT).toEqual([0, 1]);
  expect(ps.score1PT).toEqual(null);
  expect(ps.score2PT).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(4);
  expect(ps.score2FT).toEqual(4);
  expect(ps.score1FTOT).toEqual(4);
  expect(ps.score2FTOT).toEqual(5);

  // SOCCER: Penalties -------------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>3:4 penalties</strong> (0:0, 2:2, 1:1, 1:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 3, score2: 4 });
  expect(ps.extra).toEqual('penalties');
  expect(ps.results).toEqual([
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 2, score2: 2, extraScore1: null, extraScore2: null },
    { score1: 1, score2: 1, extraScore1: null, extraScore2: null },
    { score1: 1, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.isPenalties).toEqual(true);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(0);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(2);
  expect(ps.score2H2).toEqual(2);
  expect(ps.score1OT).toEqual(1);
  expect(ps.score2OT).toEqual(1);
  expect(ps.score1PT).toEqual(1);
  expect(ps.score2PT).toEqual(4);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(2);
  expect(ps.score2FT).toEqual(2);
  expect(ps.score1FTOT).toEqual(3);
  expect(ps.score2FTOT).toEqual(4);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>3:4 penalties</strong> (0:0, 2:2, 1:1, 2:2, 1:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 3, score2: 4 });
  expect(ps.extra).toEqual('penalties');
  expect(ps.results).toEqual([
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 2, score2: 2, extraScore1: null, extraScore2: null },
    { score1: 1, score2: 1, extraScore1: null, extraScore2: null },
    { score1: 2, score2: 2, extraScore1: null, extraScore2: null },
    { score1: 1, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.isPenalties).toEqual(true);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(0);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(2);
  expect(ps.score2H2).toEqual(2);
  expect(ps.score1OT).toEqual([1, 2]);
  expect(ps.score2OT).toEqual([1, 2]);
  expect(ps.score1PT).toEqual(1);
  expect(ps.score2PT).toEqual(4);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(2);
  expect(ps.score2FT).toEqual(2);
  expect(ps.score1FTOT).toEqual(3);
  expect(ps.score2FTOT).toEqual(4);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>1:0 penalties</strong> (0:0, 0:0, 3:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 1, score2: 0 });
  expect(ps.extra).toEqual('penalties');
  expect(ps.results).toEqual([
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 3, score2: 1, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasPTScore).toEqual(true);
  expect(ps.isPenalties).toEqual(true);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(0);
  expect(ps.score2H1).toEqual(0);
  expect(ps.score1H2).toEqual(0);
  expect(ps.score2H2).toEqual(0);
  expect(ps.score1PT).toEqual(3);
  expect(ps.score2PT).toEqual(1);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(0);
  expect(ps.score2FT).toEqual(0);
  expect(ps.score1FTOT).toEqual(1);
  expect(ps.score2FTOT).toEqual(0);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>1:2 penalties</strong> (0:0, 2:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.result).toEqual({ score1: 1, score2: 2 });
  expect(ps.extra).toEqual('penalties');
  expect(ps.results).toEqual([
    { score1: 0, score2: 0, extraScore1: null, extraScore2: null },
    { score1: 2, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.hasFTScore).toEqual(false);
  expect(ps.hasPTScore).toEqual(false);
  expect(ps.isPenalties).toEqual(true);
  expect(ps.isOvertime).toEqual(false);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.score1PT).toEqual(2);
  expect(ps.score2PT).toEqual(4);
  expect(ps.hasFTOTScore).toEqual(true);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(1);
  expect(ps.score2FTOT).toEqual(2);
});

test('parseScore2()', () => {
  let ps;
  const TIMESTAMP = 1625544525;

  // TENNIS: NotFinishedResult -----------------------------------------------------------------------------------------

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Canceled</span></p>');
  expect(ps.status).toEqual('canceled');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.S1).toEqual(null);
  expect(ps.away.S1).toEqual(null);
  expect(ps.home.PTS).toEqual(null);
  expect(ps.away.PTS).toEqual(null);
  expect(ps.startTime.getTime()).toEqual(TIMESTAMP * 1000);
  expect(ps.timestamp).toEqual(TIMESTAMP);

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">The match has already started.</span></p>');
  expect(ps.status).toEqual('live');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.S1).toEqual(null);
  expect(ps.away.S1).toEqual(null);
  expect(ps.home.PTS).toEqual(null);
  expect(ps.away.PTS).toEqual(null);

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Interrupted </span><strong>0:0</strong> (2:4)</p>');
  expect(ps.status).toEqual('interrupted');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.S1).toEqual(null);
  expect(ps.away.S1).toEqual(null);
  expect(ps.home.PTS).toEqual(null);
  expect(ps.away.PTS).toEqual(null);

  // TENNIS: AbortedResult  --------------------------------------------------------------------------------------------

  /*
  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Aney J. walkover</strong></p>', '');
  expect(ps.actor).toEqual('Aney J.');
  expect(ps.status).toEqual('walkover');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual(null);
  expect(ps.score1H1).toEqual(null);
  expect(ps.score2H1).toEqual(null);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Agabigun S. retired</strong> (6:4, 6<sup>9</sup>:7, 1:4)</p>', '');
  expect(ps.actor).toEqual('Agabigun S.');
  expect(ps.status).toEqual('retired');
  expect(ps.result).toEqual(null);
  expect(ps.results).toEqual([
    { score1: 6, score2: 4, extraScore1: null, extraScore2: null },
    { score1: 6, score2: 7, extraScore1: 9, extraScore2: 11 },
    { score1: 1, score2: 4, extraScore1: null, extraScore2: null }
  ]);
  expect(ps.score1H1).toEqual(6);
  expect(ps.score2H1).toEqual(4);
  expect(ps.score1H2).toEqual(6);
  expect(ps.score2H2).toEqual(7);
  expect(ps.score1H3).toEqual(1);
  expect(ps.score2H3).toEqual(4);
  expect(ps.hasFTOTScore).toEqual(false);
  expect(ps.score1FT).toEqual(null);
  expect(ps.score2FT).toEqual(null);
  expect(ps.score1FTOT).toEqual(null);
  expect(ps.score2FTOT).toEqual(null);

   */

  // TENNIS: FinishedResult  -------------------------------------------------------------------------------------------

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>0:2</strong> (0:6, 6:7)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(0);
  expect(ps.away.FT).toEqual(2);
  expect(ps.home.S1).toEqual(0);
  expect(ps.away.S1).toEqual(6);
  expect(ps.home.S2).toEqual(6);
  expect(ps.away.S2).toEqual(7);
  expect(ps.home.PTS).toEqual(6);
  expect(ps.away.PTS).toEqual(13);

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>0:2</strong> (0:6, 6<sup>2</sup>:7)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(0);
  expect(ps.away.FT).toEqual(2);
  expect(ps.home.S1).toEqual(0);
  expect(ps.away.S1).toEqual(6);
  expect(ps.home.S2).toEqual(6);
  expect(ps.away.S2).toEqual(7);
  expect(ps.home.TB1).toEqual(null);
  expect(ps.away.TB1).toEqual(null);
  expect(ps.home.TB2).toEqual(2);
  expect(ps.away.TB2).toEqual(7);
  expect(ps.home.PTS).toEqual(6);
  expect(ps.away.PTS).toEqual(13);

  ps = parseScore('tennis', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>0:2</strong></p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(0);
  expect(ps.away.FT).toEqual(2);
  expect(ps.home.S1).toEqual(null);
  expect(ps.away.S1).toEqual(null);
  expect(ps.home.PTS).toEqual(null);
  expect(ps.away.PTS).toEqual(null);

  // SOCCER: NotFinishedResult -----------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Abandoned </span><strong>1:0</strong> (1:0)</p>');
  expect(ps.status).toEqual('abandoned');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(1);
  expect(ps.away.FT).toEqual(0);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.PTS).toEqual(null);
  expect(ps.away.PTS).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Canceled</span></p>');
  expect(ps.status).toEqual('canceled');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Postponed</span></p>');
  expect(ps.status).toEqual('postponed');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '', '<p class="result-alert"><span class="bold">The match has already started.</span></p>');
  expect(ps.status).toEqual('live');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);

  // SOCCER: AbortedResult  --------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Asteras Vlachioti awarded</strong></p>', '');
  expect(ps.actor).toEqual('Asteras Vlachioti');
  expect(ps.status).toEqual('awarded');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold"></span><strong>Parnu JK Vaprus awarded</strong> (0:0, 0:1)</p>', '');
  expect(ps.actor).toEqual('Parnu JK Vaprus');
  expect(ps.status).toEqual('awarded');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(false);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);

  // SOCCER: FinishedResult  -------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>0:2</strong></p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(0);
  expect(ps.away.FT).toEqual(2);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.FTOT).toEqual(null);
  expect(ps.away.FTOT).toEqual(null);
  expect(ps.home.PTS).toEqual(null);
  expect(ps.away.PTS).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>7:0</strong> (7:0)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(7);
  expect(ps.away.FT).toEqual(0);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.FTOT).toEqual(null);
  expect(ps.away.FTOT).toEqual(null);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>2:1</strong> (1:0, 1:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual(null);
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(2);
  expect(ps.away.FT).toEqual(1);
  expect(ps.home.H1).toEqual(1);
  expect(ps.away.H1).toEqual(0);
  expect(ps.home.H2).toEqual(1);
  expect(ps.away.H2).toEqual(1);
  expect(ps.home.FTOT).toEqual(null);
  expect(ps.away.FTOT).toEqual(null);

  // SOCCER: Overtime --------------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong></p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('ET');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.FTOT).toEqual(4);
  expect(ps.away.FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('ET');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.FTOT).toEqual(4);
  expect(ps.away.FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0, 3:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('ET');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.OT).toEqual(null);
  expect(ps.away.OT).toEqual(null);
  expect(ps.home.FTOT).toEqual(4);
  expect(ps.away.FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0, 3:4, 0:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('ET');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(4);
  expect(ps.away.FT).toEqual(4);
  expect(ps.home.H1).toEqual(1);
  expect(ps.away.H1).toEqual(0);
  expect(ps.home.H2).toEqual(3);
  expect(ps.away.H2).toEqual(4);
  expect(ps.home.OT).toEqual(0);
  expect(ps.away.OT).toEqual(1);
  expect(ps.home.FTOT).toEqual(4);
  expect(ps.away.FTOT).toEqual(5);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>4:5 ET</strong> (1:0, 3:4, 0:0, 0:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('ET');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(4);
  expect(ps.away.FT).toEqual(4);
  expect(ps.home.H1).toEqual(1);
  expect(ps.away.H1).toEqual(0);
  expect(ps.home.H2).toEqual(3);
  expect(ps.away.H2).toEqual(4);
  expect(ps.home.OT).toEqual(0);
  expect(ps.away.OT).toEqual(1);
  expect(ps.home.FTOT).toEqual(4);
  expect(ps.away.FTOT).toEqual(5);

  // SOCCER: Penalties -------------------------------------------------------------------------------------------------

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>3:4 penalties</strong> (0:0, 2:2, 1:1, 1:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('penalties');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(2);
  expect(ps.away.FT).toEqual(2);
  expect(ps.home.H1).toEqual(0);
  expect(ps.away.H1).toEqual(0);
  expect(ps.home.H2).toEqual(2);
  expect(ps.away.H2).toEqual(2);
  expect(ps.home.OT).toEqual(1);
  expect(ps.away.OT).toEqual(1);
  expect(ps.home.PT).toEqual(1);
  expect(ps.away.PT).toEqual(4);
  expect(ps.home.FTOT).toEqual(3);
  expect(ps.away.FTOT).toEqual(4);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>5:6 penalties</strong> (0:0, 2:2, 1:1, 2:2, 1:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('penalties');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(true);
  expect(ps.hasPartTimeScore).toEqual(true);
  expect(ps.home.FT).toEqual(2);
  expect(ps.away.FT).toEqual(2);
  expect(ps.home.H1).toEqual(0);
  expect(ps.away.H1).toEqual(0);
  expect(ps.home.H2).toEqual(2);
  expect(ps.away.H2).toEqual(2);
  expect(ps.home.OT).toEqual(3);
  expect(ps.away.OT).toEqual(3);
  expect(ps.home.PT).toEqual(1);
  expect(ps.away.PT).toEqual(4);
  expect(ps.home.FTOT).toEqual(5);
  expect(ps.away.FTOT).toEqual(6);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>1:0 penalties</strong> (0:0, 0:0, 3:1)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('penalties');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.H2).toEqual(null);
  expect(ps.away.H2).toEqual(null);
  expect(ps.home.OT).toEqual(null);
  expect(ps.away.OT).toEqual(null);
  expect(ps.home.PT).toEqual(null);
  expect(ps.away.PT).toEqual(null);
  expect(ps.home.FTOT).toEqual(1);
  expect(ps.away.FTOT).toEqual(0);

  ps = parseScore('soccer', TIMESTAMP, '<p class="result"><span class="bold">Final result </span><strong>1:2 penalties</strong> (0:0, 2:4)</p>', '');
  expect(ps.status).toEqual('finished');
  expect(ps.additionalTime).toEqual('penalties');
  expect(ps.hasFinalScore).toEqual(true);
  expect(ps.hasFullTimeScore).toEqual(false);
  expect(ps.hasPartTimeScore).toEqual(false);
  expect(ps.home.FT).toEqual(null);
  expect(ps.away.FT).toEqual(null);
  expect(ps.home.H1).toEqual(null);
  expect(ps.away.H1).toEqual(null);
  expect(ps.home.H2).toEqual(null);
  expect(ps.away.H2).toEqual(null);
  expect(ps.home.OT).toEqual(null);
  expect(ps.away.OT).toEqual(null);
  expect(ps.home.PT).toEqual(null);
  expect(ps.away.PT).toEqual(null);
  expect(ps.home.FTOT).toEqual(1);
  expect(ps.away.FTOT).toEqual(2);

});

test('parseScore()', () => {
  let ps;
  const TIMESTAMP = 1625544525;

  // CANCELED -----------------------------------------------------------------------------------------

  ps = parseScore('tennis', TIMESTAMP, '', '<p class="result-alert"><span class="bold">Canceled</span></p>');
  expect(ps.status).toEqual('canceled');
  expect(ps.subStatus).toEqual('canceled');
  expect(ps.finalResultWinner).toEqual(null);
  expect(ps.fullTimeResultWinner).toEqual(null);
  expect(ps.hasFinalResult).toEqual(false);
  expect(ps.hasFullTimeResult).toEqual(false);
  expect(ps.hasPartTimeResult).toEqual(false);
  expect(ps.scoreText).toEqual(null);
  expect(ps.resultText).toEqual('canceled');
  expect(ps.startTime.getTime()).toEqual(TIMESTAMP * 1000);
  expect(ps.timestamp).toEqual(TIMESTAMP);
});
