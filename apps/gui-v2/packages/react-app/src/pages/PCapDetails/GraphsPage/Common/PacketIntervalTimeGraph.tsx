import React from 'react';
import { BarGraphic, IScatterGraphicElement, ScatterGraphic } from 'components/index';
import SDK from '@bisect/ebu-list-sdk';
import list from '../../../../utils/api';
import {
    getFinalScatterBucketData,
    getScatterBucketData,
} from '../../../../utils/graphs/dataTransformationScatterGraphs';
import { translate } from '../../../../utils/translation';

function PacketIntervalTimeGraph({
    currentStream,
    pcapID,
}: {
    currentStream: SDK.types.IStreamInfo | undefined;
    pcapID: string;
}) {
    const streamID = currentStream?.id;

    const initialScatter: number[][] = [];
    const [pitScatterData, setPitScatterData] = React.useState(initialScatter);

    React.useEffect(() => {
        const loadPitHistData = async (): Promise<void> => {
            const all = await list.stream.getPitHistogramForStream(pcapID, streamID);
            console.log(all.histogram);
            setPitScatterData(all.histogram);
        };
        loadPitHistData();
    }, [currentStream?.id]);

    const mediaInfoHistogram = 'Packet Interval Time Histogram';
    const generalBufferLevel = translate('general.buffer_level');

    if (pitScatterData === undefined) {
        return null;
    }
    const initialPitScatterData = getScatterBucketData(pitScatterData);
    const pitScatterFinalData = getFinalScatterBucketData(initialPitScatterData);
    // const leftMarginPitHist = getLeftMarginBarGraphic(pitHistFinalData);
    const pitScatterGraphData = {
        graphicData: pitScatterFinalData,
        title: mediaInfoHistogram,
        xAxisTitle: generalBufferLevel,
        yAxisTitle: '%',
        datakeyY: 'value',
        datakeyX: 'label',
        // leftMargin: leftMarginPitHist,
    };

    return (
        <>
            <div className="pcap-details-page-bar-graphic-container ">
                <ScatterGraphic key={currentStream?.id} data={pitScatterGraphData} />
            </div>
        </>
    );
}

export default PacketIntervalTimeGraph;
