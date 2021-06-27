
yarn run cli resetLogFiles
yarn run cli resetDB

yarn run cli crawlMatchPages --interval 1 --datestr 20210627 --sport "soccer" --sportId 1 --daysAfter 0 --daysBefore 1
yarn run cli crawlMatchPages --interval 5 --sport "soccer" --sportId 1 --daysAfter 2 --daysBefore 15
yarn run cli crawlMatchPages --interval 5 --sport "soccer" --sportId 1 --daysAfter 0 --daysBefore 1

yarn run cli crawlMatchLinks --interval 5 --status ""

