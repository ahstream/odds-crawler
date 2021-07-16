
yarn cli deleteLogFiles
yarn cli resetDB
yarn cli initOddsHistoryDB
yarn cli moveBackToMatchLinksQueue

yarn cli crawlMatchPages --interval 1 --datestr 20210627 --sportName "soccer" --daysAfter 0 --daysBefore 1
yarn cli crawlMatchPages --interval 1 --sportName "soccer" --daysAfter 1 --daysBefore 2
yarn cli crawlMatchPages --interval 500 --sportName "soccer" --daysAfter 60 --daysBefore 30
yarn cli crawlMatchPages --interval 5000 --sportName "tennis" --daysAfter 60 --daysBefore 30
yarn cli crawlMatchPages --interval 5000 --sportName "soccer" --daysAfter 0 --daysBefore 0

yarn cli crawlAllSportsMatchPages --interval 100 --daysAfter 1 --daysBefore 1
yarn cli crawlAllSportsMatchPages --interval 1 --daysAfter 10 --daysBefore 20
yarn cli crawlAllSportsMatchPages --interval 1 --daysAfter 1 --daysBefore 1 --intervalMax 3 --daysAfterMax 5 --daysBeforeMax 5 --initWithMaxDays

yarn cli crawlMatchLinks --interval 60 --status ""
yarn cli crawlMatchLinks --interval 60 --status "" --deleteLogFiles
yarn cli crawlMatchLinks --interval 5 --status "error"
yarn cli crawlMatchLinks --interval 60 --status "new"

yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/soccer/england/premier-league-2020-2021/arsenal-brighton-2qsbaz5A/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/basketball/usa/nba/milwaukee-bucks-phoenix-suns-4nnd7v16/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/hockey/usa/nhl/tampa-bay-lightning-montreal-canadiens-YuciXAzR/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/tennis/united-kingdom/atp-wimbledon/djokovic-novak-berrettini-matteo-6ZCocWsb/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/american-football/usa/nfl-2020-2021/tampa-bay-buccaneers-kansas-city-chiefs-254G7rIq/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/beach-volleyball/rwanda/rubavu-men/schalk-chaim-brunner-theodore-canet-arthur-rotar-teo-8EmdzjTR/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/futsal/brazil/lnf/assoeva-joinville-krona-40uKSVSm/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/handball/germany/bundesliga/die-eulen-ludwigshafen-goppingen-lfnAIiff/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/pesapallo/finland/superpesis/hyvinkaan-tahko-joensuun-maila-joma-fmLUQapM/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/rugby-league/australia/nrl/cronulla-sharks-new-zealand-warriors-tAdYW13c/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/rugby-union/world/lions-tour/south-africa-british-irish-lions-YLnhifw5/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/snooker/world/championship-league-2021/dott-graeme-carter-ali-j59RCFKI/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/volleyball/world/world-championship-u20-women/russia-usa-SUhWhKe3/'
yarn cli addMatch --deleteLogFiles --url 'xxxx'

yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/soccer/england/premier-league-2020-2021/arsenal-brighton-2qsbaz5A/'
yarn cli addMatch --deleteLogFiles --url 'https://www.oddsportal.com/soccer/england/premier-league/brentford-arsenal-863eg7q9/'





