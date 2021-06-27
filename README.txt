
yarn cli resetLogFiles
yarn cli resetDB
yarn cli test

yarn cli crawlMatchPages --interval 1 --datestr 20210627 --sport "soccer" --daysAfter 0 --daysBefore 1
yarn cli crawlMatchPages --interval 5 --sport "soccer" --daysAfter 2 --daysBefore 15
yarn cli crawlMatchPages --interval 5 --sport "soccer" --daysAfter 0 --daysBefore 1
yarn cli crawlMatchPages --interval 5 --sport "tennis" --daysAfter 0 --daysBefore 10

yarn cli crawlMatchLinks --interval 5 --status ""

