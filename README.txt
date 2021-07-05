
yarn cli resetLogFiles
yarn cli resetDB
yarn cli initOddsHistoryDB
yarn cli moveBackToMatchLinksQueue

yarn cli crawlMatchPages --interval 1 --datestr 20210627 --sport "soccer" --daysAfter 0 --daysBefore 1
yarn cli crawlMatchPages --interval 5 --sport "soccer" --daysAfter 2 --daysBefore 15
yarn cli crawlMatchPages --interval 500 --sport "soccer" --daysAfter 300 --daysBefore 1
yarn cli crawlMatchPages --interval 5000 --sport "tennis" --daysAfter 300 --daysBefore 1

yarn cli crawlMatchLinks --interval 50 --status ""
yarn cli crawlMatchLinks --interval 5 --status "error"

