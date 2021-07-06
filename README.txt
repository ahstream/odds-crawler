
yarn cli deleteLogFiles
yarn cli resetDB
yarn cli initOddsHistoryDB
yarn cli moveBackToMatchLinksQueue

yarn cli crawlMatchPages --interval 1 --datestr 20210627 --sport "soccer" --daysAfter 0 --daysBefore 1
yarn cli crawlMatchPages --interval 5 --sport "soccer" --daysAfter 2 --daysBefore 15
yarn cli crawlMatchPages --interval 500 --sport "soccer" --daysAfter 60 --daysBefore 30
yarn cli crawlMatchPages --interval 5000 --sport "tennis" --daysAfter 60 --daysBefore 30

yarn cli crawlMatchLinks --interval 60 --status ""
yarn cli crawlMatchLinks --interval 60 --status "" --deleteLogFiles
yarn cli crawlMatchLinks --interval 5 --status "error"
yarn cli crawlMatchLinks --interval 60 --status "new"


yarn cli getMatch --deleteLogFiles --url 'https://www.oddsportal.com/soccer/europe/champions-league/cfr-cluj-borac-banja-luka-I3ZO0jPa/'

yarn cli getMatch --deleteLogFiles --url 'https://www.oddsportal.com/soccer/argentina/primera-nacional/alvarado-chacarita-juniors-C2xos3i9/'

yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/tennis/tunisia/itf-m15-monastir-25-men/weightman-oscar-lee-duck-hee-MmnTbwBe/'




