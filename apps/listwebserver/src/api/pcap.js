const child_process = require('child_process');
const path = require('path');
const router = require('express').Router();
const multer = require('multer');
const util = require('util');
const influxDbManager = require('../managers/influx-db');
const fs = require('../util/filesystem');
import logger from '../util/logger';
const API_ERRORS = require('../enums/apiErrors');
const HTTP_STATUS_CODE = require('../enums/httpStatusCode');
const CONSTANTS = require('../enums/constants');
const Pcap = require('../models/pcap');
const pcapController = require('../controllers/pcap');
const Stream = require('../models/stream');
const StreamCompare = require('../models/streamCompare');
const streamsController = require('../controllers/streams');
const {
    pcapSingleStreamIngest,
    pcapIngest,
    pcapReanalyze,
    pcapFromLocalFile,
    pcapOnlyUpload
} = require('../util/analysis');
const {
    api
} = require("@bisect/ebu-list-sdk");
const websocketManager = require('../managers/websocket');
const {
    getUserId,
    checkIsReadOnly
} = require('../auth/middleware');
import {
    verifyIfFramesAreExtractedOrExtract
} from '../controllers/streams';
import {
    api
} from '@bisect/ebu-list-sdk';
const pcap2 = require('../controllers/pcap2');
import {
    getUserFolder,
    getUserId,
    generateRandomPcapFilename,
    generateRandomPcapDefinition
} from '../util/analysis/utils';

const exec = util.promisify(child_process.exec);

/**
 *  Analyze local PCAP file
 *  URL: /api/pcap/local
 *  Method: POST
 *  Request:
 *  {
 *      path: path to file on a filesystem accessible by LIST
 *      name: the name that will be assigned by LIST
 *      pcapId: the ID to assign to the pcap
 *  }
 */
router.post(
    '/:pcapID/local',
    checkIsReadOnly,
    async (req, res, next) => {
            // router.post(
            //     '/local',
            //     (req, res, next) => {
            const {
                pcapID
            } = req.params;
            if (!api.pcap.isLocalPcapAnalysisParams(req.body)) {
                res.status(HTTP_STATUS_CODE.CLIENT_ERROR.BAD_REQUEST).send();
                return;
            }

            const userId = getUserId(req);
            const upload = await pcap2.localUpload(userId, pcapID, req.body);
            req.pcap = upload.pcap;
            req.file = upload.file;
            res.status(HTTP_STATUS_CODE.SUCCESS.CREATED).send(req.pcap);

            next();
        },
        pcapFromLocalFile
);

function isAuthorized(req, res, next) {
    const {
        pcapID
    } = req.params;

    if (pcapID) {
        const userId = getUserId(req);

        Pcap.findOne({
                owner_id: userId,
                id: pcapID,
            })
            .exec()
            .then((data) => {
                if (data) next();
                else res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND);
            })
            .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
    } else next();
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        req.pcap = generateRandomPcapDefinition(req);
        fs.createIfNotExists(req.pcap.folder);
        cb(null, req.pcap.folder);
    },
    filename: function (req, file, cb) {
        cb(null, generateRandomPcapFilename(file));
    },
});

const upload = multer({
    storage: storage,
});

/**
 *  PCAP file upload
 *  URL: /api/pcap/upload
 *  Method: PUT
 *  This is used to only upload a pcap to the database
 *  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *  This call can't be moved to anywhere after the next ones or they will match before to a pcapID
 *  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */
router.put(
    '/upload',
    checkIsReadOnly,
    upload.single('pcap', 'originalFilename'),
    pcapOnlyUpload,
    (req, res, next) => {
        res.status(HTTP_STATUS_CODE.SUCCESS.CREATED).send(req.pcap);
    }
);

// Check if the user can access the pcap
router.use('/:pcapID', isAuthorized);

/**
 *  PCAP file upload
 *  URL: /api/pcap/
 *  Method: PUT
 */
router.put(
    '/',
    checkIsReadOnly,
    upload.single('pcap', 'originalFilename'),
    (req, res, next) => {
        res.status(HTTP_STATUS_CODE.SUCCESS.CREATED).send(req.pcap);
        next();
    },
    pcapIngest
);

/* Reanalyze an existing PCAP file */
router.put(
    '/:pcapId/reanalyze',
    (req, res, next) => {
        const {
            pcapId
        } = req.params;

        Stream.deleteMany({
                pcap: pcapId,
            })
            .exec()
            .then(() => {
                return influxDbManager.deleteSeries(pcapId);
            })
            .then(() => {
                return Pcap.findOne({
                    id: pcapId,
                }).exec();
            })
            .then((pcap) => {
                const pcapFolder = `${getUserFolder(req)}/${pcapId}`;
                const pcapLocation = `${pcapFolder}/${pcap.pcap_file_name}`;

                req.file = {
                    path: pcapLocation,
                    originalname: pcap.file_name,
                    filename: pcap.pcap_file_name,
                };
                req.pcap = {
                    uuid: pcapId,
                    folder: pcapFolder,
                };

                res.locals = {
                    pcapFileName: pcap.pcap_file_name,
                    pcapFilePath: pcapLocation,
                };

                next();
            })
            .catch((output) => {
                logger('Stream Re-ingest').error(`${output}`);
                res.status(HTTP_STATUS_CODE.SERVER_ERROR.INTERNAL_SERVER_ERROR).send(
                    API_ERRORS.PCAP_EXTRACT_METADATA_ERROR
                );
            });
    },
    (req, res, next) => {
        res.status(HTTP_STATUS_CODE.SUCCESS.OK).send();
        next();
    },
    pcapReanalyze
);

router.patch(
    '/:pcapId',
    checkIsReadOnly,
    (req, res, next) => {
        const {
            pcapId
        } = req.params;
        const sdps = req.body.sdps;
        const transport_type = req.body.transport_type

        Stream.deleteMany({
                pcap: pcapId,
            })
            .exec()
            .then(() => {
                return influxDbManager.deleteSeries(pcapId);
            }).catch((err) => {
                logger('This series does not exist yet').error(`${err}`);
            })
            .then(() => {
                return Pcap.findOneAndUpdate({
                    id: pcapId,
                }, {
                    sdps: sdps,
                    transport_type: transport_type
                }, {
                    upsert: true
                }).exec();
            })
            .then((pcap) => {
                const pcapFolder = `${getUserFolder(req)}/${pcapId}`;
                const pcapLocation = `${pcapFolder}/${pcap.pcap_file_name}`;

                req.file = {
                    path: pcapLocation,
                    originalname: pcap.file_name,
                    filename: pcap.pcap_file_name,
                };
                req.pcap = {
                    uuid: pcapId,
                    folder: pcapFolder,
                    data: pcap
                };

                res.locals = {
                    pcapFileName: pcap.pcap_file_name,
                    pcapFilePath: pcapLocation,
                };

                next();

            })
    },
    (req, res, next) => {
        res.status(HTTP_STATUS_CODE.SUCCESS.OK).send();
        next();
    },
    pcapReanalyze
);

/* Get all Pcaps found */
router.get('/', (req, res) => {
    const userId = getUserId(req);
    Pcap.find({
            owner_id: userId,
        })
        .exec()
        .then((data) => res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/* Delete a PCAP */
router.delete('/:pcapID/', checkIsReadOnly, (req, res) => {
    const {
        pcapID
    } = req.params;
    const path = `${getUserFolder(req)}/${pcapID}`;

    Pcap.deleteOne({
            id: pcapID,
        })
        .exec()
        .then(() => {
            return fs.delete(path); // delete the whole pcap folder
        })
        .then(() => {
            // delete the associated streams and comparisons
            StreamCompare.deleteMany({
                'config.main.pcap': pcapID,
            }).exec();
            StreamCompare.deleteMany({
                'config.reference.pcap': pcapID,
            }).exec();
            return Stream.deleteMany({
                pcap: pcapID,
            }).exec();
        })
        .then(() => {
            return influxDbManager.deleteSeries(pcapID); // delete the associated streams
        })
        .then(() => {
            res.status(HTTP_STATUS_CODE.SUCCESS.OK).send();
        })
        .then(() => {
            const userId = getUserId(req);
            websocketManager.instance().sendEventToUser(userId, {
                event: api.wsEvents.Pcap.deleted,
                data: {
                    id: pcapID,
                },
            });
        })
        .catch((e) => {
            console.error(`${e}`);
            return res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND);
        });
});

/* Get the report for a pcap */
router.get('/:pcapID/report', (req, res) => {
    const {
        pcapID
    } = req.params;
    const reportType = req.query.type;

    pcapController
        .getReport(pcapID, reportType)
        .then((report) => {
            Pcap.findOne({
                    id: pcapID,
                })
                .exec()
                .then((data) => {
                    const filename = data.file_name.replace(/\.[^\.]*$/, '');
                    res.setHeader('Content-disposition', `attachment; filename=${filename}.${reportType}`);
                    res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(report);
                });
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/* Download a original capture file */
router.get('/:pcapID/download_original', (req, res, next) => {
    const {
        pcapID
    } = req.params;

    logger('original-get').info(`Getting Original PCAP for ${pcapID}`);

    Pcap.findOne({
            id: pcapID,
        })
        .exec()
        .then((data) => {
            const pcapPath = path.join(`${getUserFolder(req)}`, `${pcapID}`, data.capture_file_name); // `${getUserFolder(req)}/${pcapID}/`;

            res.download(pcapPath, (err) => {
                if (err) {
                    next(err);
                } else {
                    logger('download-').info(`File ${pcapPath}`);
                }
            });
        });
});

/* Download a PCAP File */
router.get('/:pcapID/download', (req, res, next) => {
    const {
        pcapID
    } = req.params;

    logger('pcap-get').info(`Getting PCAP for ${pcapID}`);

    Pcap.findOne({
            id: pcapID,
        })
        .exec()
        .then((data) => {
            const filename = data.file_name.replace(/\.[^\.]*$/, '') + '.pcap';
            const pcapPath = path.join(`${getUserFolder(req)}`, `${pcapID}`, `${data.pcap_file_name}`);

            res.download(pcapPath, filename, (err) => {
                if (err) {
                    next(err);
                } else {
                    logger('download').info(`File ${pcapPath}`);
                }
            });
        });
});

/* Get info from pcap */
router.get('/:pcapID/', (req, res) => {
    const {
        pcapID
    } = req.params;

    Pcap.findOne({
            id: pcapID,
        })
        .exec()
        .then((data) => res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/analytics/PtpOffset', (req, res) => {
    const {
        pcapID
    } = req.params;

    const chartData = influxDbManager.getPtpOffsetSamplesByPcap(pcapID);
    chartData
        .then((data) => res.json(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/* Get all streams from a pcap */
router.get('/:pcapID/streams/', (req, res) => {
    const {
        pcapID
    } = req.params;
    streamsController
        .getStreamsForPcap(pcapID)
        .then((data) => res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/*** STREAM ***/

/* Get _meta.json file for stream */
router.get('/:pcapID/stream/:streamID', (req, res) => {
    const {
        streamID
    } = req.params;

    streamsController
        .getStreamWithId(streamID)
        .then((data) => res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/* Get _help.json file for stream */
router.get('/:pcapID/stream/:streamID/help', (req, res) => {
    const {
        streamID
    } = req.params;

    streamsController
        .getStreamWithId(streamID)
        .then((data) => res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/* Patch the stream info with a new name */
router.patch('/:pcapID/stream/:streamID', checkIsReadOnly, (req, res) => {
    const {
        streamID
    } = req.params;
    const alias = req.body.name;

    // todo: maybe check if it found a document (check data.n)?
    Stream.updateOne({
            id: streamID,
        }, {
            alias: alias,
        })
        .exec()
        .then((data) => res.status(HTTP_STATUS_CODE.SUCCESS.OK).send(data))
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/stream/:streamID/analytics/CInst/histogram', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;

    const path = `${getUserFolder(req)}/${pcapID}/${streamID}/${CONSTANTS.CINST_FILE}`;
    fs.sendFileAsResponse(path, res);
});

router.get('/:pcapID/stream/:streamID/analytics/Vrx/histogram', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;

    const path = `${getUserFolder(req)}/${pcapID}/${streamID}/${CONSTANTS.VRX_FILE}`;
    fs.sendFileAsResponse(path, res);
});

router.get('/:pcapID/stream/:streamID/analytics/Pit/histogram', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;

    const path = streamsController.getPitFilePathForStream(getUserId(req), pcapID, streamID);
    fs.sendFileAsResponse(path, res);
});

/* Audio Delays */
router.get('/:pcapID/stream/:streamID/analytics/AudioPktTsVsRtpTsRaw', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    const {
        from,
        to
    } = req.query;

    let chartData = influxDbManager.getAudioPktTsVsRtpTsRaw(pcapID, streamID, from, to);
    chartData
        .then((data) => {
            res.json(data);
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/stream/:streamID/analytics/AudioPktTsVsRtpTsGrouped', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    const {
        from,
        to,
        group
    } = req.query;

    let chartData = influxDbManager.getAudioPktTsVsRtpTsGrouped(pcapID, streamID, from, to, group);
    chartData
        .then((data) => {
            res.json(data);
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/stream/:streamID/analytics/DeltaPacketTimeVsRtpTimeRaw', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    const {
        from,
        to
    } = req.query;

    let chartData = influxDbManager.getDeltaPacketTimeVsRtpTimeRaw(pcapID, streamID, from, to);
    chartData
        .then((data) => {
            res.json(data);
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/stream/:streamID/analytics/DeltaPacketTimeVsRtpTimeGrouped', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    const {
        from,
        to,
        group
    } = req.query;

    let chartData = influxDbManager.getDeltaPacketTimeVsRtpTimeGrouped(pcapID, streamID, from, to, group);
    chartData
        .then((data) => {
            res.json(data);
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/stream/:streamID/analytics/AudioTimeStampedDelayFactor', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    const {
        from,
        to,
        tolerance,
        tsdfmax
    } = req.query;
    const limit = tolerance * 17; // EBU recommendation #3337

    let chartData = influxDbManager.getAudioTimeStampedDelayFactor(pcapID, streamID, from, to);
    chartData
        .then((data) => {
            data.data.forEach((e) => {
                e['high-tolerance'] = tolerance;
                // display the red limit only when relevant
                if (tsdfmax > 0.3 * limit) e['high-limit'] = limit;
            });
            res.json(data);
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

/* Ancillary */

router.get('/:pcapID/stream/:streamID/analytics/packetsPerFrame', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    const {
        from,
        to
    } = req.query;

    let chartData = influxDbManager.getPacketsPerFrame(pcapID, streamID, from, to);
    chartData
        .then((data) => {
            res.json(data);
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
});

router.get('/:pcapID/stream/:streamID/analytics/AncillaryPktHistogram', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;

    const path = `${getUserFolder(req)}/${pcapID}/${streamID}/${CONSTANTS.ANC_PKT_FILE}`;
    fs.sendFileAsResponse(path, res);
});

/* */
router.get('/:pcapID/stream/:streamID/analytics/:measurement', (req, res) => {
    const {
        pcapID,
        streamID,
        measurement
    } = req.params;
    const {
        from,
        to,
        groupByNanoseconds,
        group
    } = req.query;

    let chartData = null;

    if (measurement === api.constants.measurements.C_INST) {
        chartData = influxDbManager.getCInstByStream(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.C_INST_RAW) {
        chartData = influxDbManager.getCInstRaw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.C_INST_GROUPED) {
        chartData = influxDbManager.getCInstGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.VRX_IDEAL) {
        chartData = influxDbManager.getVrxIdeal(pcapID, streamID, from, to, groupByNanoseconds);
    } else if (measurement === api.constants.measurements.VRX_IDEAL_RAW) {
        chartData = influxDbManager.getVrxIdealRaw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.VRX_IDEAL_GROUPED) {
        chartData = influxDbManager.getVrxIdealGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.DELTA_TO_IDEAL_TPR0_RAW) {
        chartData = influxDbManager.getDeltaToIdealTpr0Raw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.DELTA_TO_IDEAL_TPR0_GROUPED) {
        chartData = influxDbManager.getDeltaToIdealTpr0Grouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.DELTA_RTP_TS_VS_PACKET_TS_RAW) {
        chartData = influxDbManager.getDeltaRtpTsVsPacketTsRaw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.DELTA_RTP_TS_VS_PACKET_TS_GROUPED) {
        chartData = influxDbManager.getDeltaRtpTsVsPacketTsGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.DELTA_PACKET_TIME_VS_RTP_TIME_RAW) {
        chartData = influxDbManager.getDeltaPacketTimeVsRtpTimeRaw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.DELTA_PACKET_TIME_VS_RTP_TIME_GROUPED) {
        chartData = influxDbManager.getDeltaPacketTimeVsRtpTimeGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.DELTA_TO_PREVIOUS_RTP_TS_RAW) {
        chartData = influxDbManager.getDeltaToPreviousRtpTsRaw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.DELTA_TO_PREVIOUS_RTP_TS_GROUPED) {
        chartData = influxDbManager.getDeltaToPreviousRtpTsGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.DELTA_RTP_VS_NT_RAW) {
        chartData = influxDbManager.getDeltaRtpVsNt(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.DELTA_RTP_VS_NT_TICKS_GROUPED) {
        chartData = influxDbManager.getDeltaRtpVsNtGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.AUDIO_PKT_TS_VS_RTP_TS_RAW) {
        chartData = influxDbManager.getAudioPktTsVsRtpTsRaw(pcapID, streamID, from, to);
    } else if (measurement === api.constants.measurements.AUDIO_PKT_TS_VS_RTP_TS_GROUPED) {
        chartData = influxDbManager.getAudioPktTsVsRtpTsGrouped(pcapID, streamID, from, to, group);
    } else if (measurement === api.constants.measurements.AUDIO_TIME_STAMPED_DELAY_FACTOR) {
        chartData = influxDbManager.getAudioPktTsVsRtpTsGrouped(pcapID, streamID, from, to, group);
    }
    chartData.then((data) => res.json(data));
});

router.get('/:pcapID/stream/:streamID/analytics/:measurement/count', (req, res) => {
    const {
        pcapID,
        streamID,
        measurement
    } = req.params;


    let chartData = null;

    if (measurement === api.constants.measurements.C_INST) {
        chartData = influxDbManager.getCInstCount(pcapID, streamID);
    } else if (measurement === api.constants.measurements.VRX_IDEAL) {
        chartData = influxDbManager.getVrxIdealCount(pcapID, streamID);
    } else if (measurement === api.constants.measurements.DELTA_TO_IDEAL_TPR0) {
        chartData = influxDbManager.getDeltaToIdealTpr0Count(pcapID, streamID);
    } else if (measurement === api.constants.measurements.DELTA_RTP_TS_VS_PACKET_TS) {
        chartData = influxDbManager.getDeltaRtpTsVsPacketTsCount(pcapID, streamID);
    } else if (measurement === api.constants.measurements.DELTA_PACKET_TIME_VS_RTP_TIME) {
        chartData = influxDbManager.getDeltaPacketTimeVsRtpTimeCount(pcapID, streamID);
    } else if (measurement === api.constants.measurements.DELTA_TO_PREVIOUS_RTP_TS) {
        chartData = influxDbManager.getDeltaToPreviousRtpTsCount(pcapID, streamID);
    } else if (measurement === api.constants.measurements.DELTA_RTP_VS_NT) {
        chartData = influxDbManager.getDeltaRtpVsNtCount(pcapID, streamID);
    } else if (measurement === api.constants.measurements.AUDIO_PKT_TS_VS_RTP_TS) {
        chartData = influxDbManager.getAudioPktTsVsRtpTsCount(pcapID, streamID);
    }
    chartData.then((data) => res.json(data));
});

/* PUT new help information for stream */
router.put(
    '/:pcapID/stream/:streamID/help',
    checkIsReadOnly,
    (req, res, next) => {
        const {
            pcapID,
            streamID
        } = req.params;

        Stream.findOneAndUpdate({
                    id: streamID,
                },
                req.body, {
                    new: true,
                    overwrite: true,
                }
            )
            .exec()
            .then(() => {
                return Pcap.findOne({
                    id: pcapID,
                }).exec();
            })
            .then((pcap) => {
                const pcap_folder = `${getUserFolder(req)}/${pcapID}`;
                const pcap_location = `${pcap_folder}/${pcap.pcap_file_name}`;

                // sets req.file, which is used by the ingest system
                req.file = {
                    path: pcap_location,
                    originalname: pcap.file_name,
                    filename: pcap.pcap_file_name,
                };

                // sets req.pcap, which is used by the ingest system
                req.pcap = {
                    uuid: pcapID,
                    folder: pcap_folder,
                };

                next();
            })
            .catch((output) => {
                logger('Stream Re-ingest').error(`${output.stdout} ${output.stderr}`);
                res.status(HTTP_STATUS_CODE.SERVER_ERROR.INTERNAL_SERVER_ERROR).send(
                    API_ERRORS.PCAP_EXTRACT_METADATA_ERROR
                );
            });
    },
    pcapSingleStreamIngest,
    (req, res) => {
        res.status(HTTP_STATUS_CODE.SUCCESS.OK).send();
    }
);

/* Get all frames for stream */
router.get('/:pcapID/stream/:streamID/frames', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;

    if (fs.folderExists(`${getUserFolder(req)}/${pcapID}`)) {
        const path = `${getUserFolder(req)}/${pcapID}/${streamID}`;

        const frames = fs
            .getAllFirstLevelFolders(path)
            .map((frame) => fs.readFile(`${path}/${frame.id}/${CONSTANTS.META_FILE}`));

        Promise.all(frames).then((data) => res.send(data));
    } else {
        res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND);
    }
});

/*** FRAME ***/

router.get('/:pcapID/stream/:streamID/requestFrames', (req, res) => {
    verifyIfFramesAreExtractedOrExtract(req).then(() => {
        res.status(HTTP_STATUS_CODE.SUCCESS.OK).send();
    });
});

/* Get png file for a frame */
router.get('/:pcapID/stream/:streamID/frame/:frameID/png', (req, res) => {
    verifyIfFramesAreExtractedOrExtract(req).then(() => {
        const {
            pcapID,
            streamID,
            frameID
        } = req.params;
        const filePath = `${getUserFolder(req)}/${pcapID}/${streamID}/${frameID}/${CONSTANTS.PNG_FILE}`;

        fs.sendFileAsResponse(filePath, res);
    });
});

/*** Audio ***/
/* Get mp3 file for an audio stream */

function renderMp3(req, res) {
    const {
        pcapID,
        streamID
    } = req.params;
    var {
        channels
    } = req.query;

    if (channels === undefined || channels === '') {
        channels = '0'; // keep the first channel by default
    }

    Stream.findOne({
            id: streamID,
        })
        .exec()
        .then((data) => {
            const folderPath = `${getUserFolder(req)}/${pcapID}/${streamID}/`;
            const rawFilePath = `${folderPath}/raw`;
            const mp3FilePath = `${folderPath}/audio-${channels}.mp3`;
            const encodingBits = data.media_specific.encoding == 'L24' ? 24 : 16;
            const sampling = parseInt(data.media_specific.sampling) / 1000;
            const channelNumber = data.media_specific.number_channels;
            // ffmpeg supports up to 16 input channels
            const channelMapping = channels
                .split(',')
                .slice(0, 16)
                .map(function (i) {
                    return '-map_channel 0.0.' + i;
                })
                .join(' ');
            const ffmpegCommand = `ffmpeg -hide_banner -y -f s${encodingBits}be -ar ${sampling}k -ac ${channelNumber} -i "${rawFilePath}" ${channelMapping} -codec:a libmp3lame -qscale:a 2 "${mp3FilePath}"`;

            logger('render-mp3').info(`Command: ${ffmpegCommand}`);
            exec(ffmpegCommand)
                .then((output) => {
                    logger('render-mp3').info(output.stdout);
                    logger('render-mp3').info(output.stderr);
                    const userId = getUserId(req);
                    websocketManager.instance().sendEventToUser(userId, {
                        event: api.wsEvents.Mp3.rendered,
                        data: {
                            channels: channels,
                        },
                    });
                })
                .catch((output) => {
                    logger('render-mp3').error(output.stdout);
                    logger('render-mp3').error(output.stderr);
                    const userId = getUserId(req);
                    websocketManager.instance().sendEventToUser(userId, {
                        event: api.wsEvents.Mp3.failed,
                    });
                });
            res.status(HTTP_STATUS_CODE.SUCCESS.OK).send();
        })
        .catch(() => res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND));
}

router.get('/:pcapID/stream/:streamID/downloadmp3', (req, res) => {
    const {
        pcapID,
        streamID
    } = req.params;
    var {
        channels
    } = req.query;
    if (channels === undefined || channels === '') {
        channels = '0'; // keep first channel by default
    }
    const folderPath = `${getUserFolder(req)}/${pcapID}/${streamID}`;
    const filePath = `${folderPath}/audio-${channels}.mp3`;

    if (fs.fileExists(filePath)) {
        fs.sendFileAsResponse(filePath, res);
        logger('download-mp3').info(`Mp3 file ${filePath} already exist`);
    } else {
        logger('download-mp3').info(`Render mp3 file ${filePath}`);
        renderMp3(req, res);
    }
});

router.get('/:pcapID/stream/:streamID/rendermp3', (req, res) => {
    renderMp3(req, res);
});

router.get('/:pcapID/stream/:streamID/ancillary/:filename', (req, res) => {
    const {
        pcapID,
        streamID,
        filename
    } = req.params;
    const filePath = `${getUserFolder(req)}/${pcapID}/${streamID}/${filename}`;
    logger('ancillary').info(`${filePath}`);

    if (fs.fileExists(filePath)) {
        fs.sendFileAsResponse(filePath, res);
    } else {
        logger('ancillary').warn(`File ${filePath} does not exist`);
        res.status(HTTP_STATUS_CODE.CLIENT_ERROR.NOT_FOUND).send(API_ERRORS.RESOURCE_NOT_FOUND);
    }
});

module.exports = router;