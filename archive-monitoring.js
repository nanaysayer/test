import spawn from 'child_process';
import {sendWarningMail} from '../utils.js'
import {logger} from '../log.js';

const LAST_MINUTES = 128
const TOLERANCE_IN_SEC = 65;

const getFiles = path => {
    return new Promise( resolve => {
        let result = '',
            spl,
            lastMinutesComand = ` -${LAST_MINUTES}`,
            proc = spawn.spawn(
                'find', [path, '-name', " '*.mp4'", ' -mmin', lastMinutesComand, ' -printf', " '%TY-%Tm-%Td %TH:%TM:%TS+ %f\n'"], {shell: true}
            );
        proc.stdout.on('data', data => {
            result += data.toString()
        });
        proc.on('close', () => {
            spl = result.split('\n');
            spl.pop()
            resolve(spl)
        })
    })
}

const getTime = files => files.map(file =>  {

    let splittedInfo = file.split('+ ');
    let startedTime = splittedInfo[1].split('T');
    let formattedStartTime = startedTime[1].replace(/-/g, ':').replace('.mp4', '');
    let start = `${startedTime[0]} ${formattedStartTime}`
    return {
        started: start,
        ended: splittedInfo[0]
    }
})

const getArchDurationInSec = (started, ended) => {
    let startedInSec = (Date.parse(started) / 1000);
    let endenInSec = (Date.parse(ended) / 1000);
    return endenInSec - startedInSec
}

const findBigArchives = (timeData, cutoff) => {
    let maxCutoffInSec = ((cutoff * 60) + TOLERANCE_IN_SEC)
    let filesGreaterThanExpected = []
    for (let time of timeData) {
        let archDurationInSec = getArchDurationInSec(time.started, time.ended)
        if (maxCutoffInSec < archDurationInSec) {
            filesGreaterThanExpected.push(time)
        }
    }
    return filesGreaterThanExpected
}


const getBigArchivesOfMonitor = async(monitor) => {
        const fullPathToArchives = `${monitor.dir}${monitor.path}`
        logger.info(fullPathToArchives)
        let bigArchives = []
        let allFiles = await getFiles(fullPathToArchives);
        if (allFiles?.length > 0) {
            logger.info('ALL FILES LLENGTH: '+ allFiles.length)
            let filesData = getTime(allFiles);
            bigArchives = findBigArchives(filesData, monitor.cutoff);
        }
        return {bigArchives, monitor: fullPathToArchives}

}

const checkResultsAndSendMail = async (archives) => {
    let archivesForMail = archives.filter(archiveObj => archiveObj.bigArchives.length > 0)
    if (archivesForMail.length > 0 ) await sendWarningMail(archivesForMail)

}


export {
    checkResultsAndSendMail,
    getBigArchivesOfMonitor
}