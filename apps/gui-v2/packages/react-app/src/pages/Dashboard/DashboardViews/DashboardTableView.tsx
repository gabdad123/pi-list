import React from 'react';
import { DetailsTableHOC, SearchBar } from 'components/index';
import SDK from '@bisect/ebu-list-sdk';
import '../styles.scss';
import UploadPcap from '../UploadPcap/UploadPcap';
import { useRecoilValue } from 'recoil';
import { pcapsAnalysingAtom } from '../../../store/gui/pcaps/pcapsAnalysing';
import { findOne } from '../../../utils/searchBar';

interface IDetailsTableData {
    id: string;
    filename: string;
    index: number;
    compliant: boolean | undefined;
    video: number;
    audio: number;
    ttml: number;
    ancillary: number;
    unknown: number;
}

interface IPropTypes {
    pcaps: SDK.types.IPcapInfo[];
    onRowClicked: (id: string, e: React.MouseEvent<HTMLElement>) => void;
    onDoubleClick: (id: string) => void;
    selectedPcapIds: string[];
}

const DashboardTableView: React.FunctionComponent<IPropTypes> = ({
    pcaps,
    onRowClicked,
    onDoubleClick,
    selectedPcapIds,
}: IPropTypes) => {
    const pcapsAnalysing = useRecoilValue(pcapsAnalysingAtom);

    const getTableData = (pcaps: SDK.types.IPcapInfo[]): IDetailsTableData[] => {
        const tableData: IDetailsTableData[] = [];
        pcaps.forEach((item, index) => {
            const data = {
                id: item.id,
                filename: item.file_name,
                index: index,
                compliant: item.summary === undefined ? undefined : item.summary.error_list.length === 0 ? true : false,
                video: item.video_streams,
                ttml: item.ttml_streams,
                audio: item.audio_streams,
                ancillary: item.anc_streams,
                unknown:
                    item.total_streams -
                    (item.video_streams + item.audio_streams + item.anc_streams + item.ttml_streams),
            };
            tableData.push(data);
        });

        return tableData;
    };

    const [filterString, setFilterString] = React.useState<string>('');
    const [filterTableData, setFilterTableData] = React.useState<any[]>(getTableData(pcaps));

    React.useEffect(() => {
        if (filterString === '') {
            setFilterTableData(getTableData(pcaps));
        } else {
            const tokens = filterString.split(/\s+/).filter(v => v !== '');

            const dataFilter = getTableData(pcaps).filter(value => {
                const filenameResult = findOne(value.filename, tokens);
                const compliantResult =
                    value.unknown > 0
                        ? findOne('unknown', tokens)
                        : value.compliant === true
                        ? findOne('compliant', tokens)
                        : findOne('not', tokens) || findOne('compliant', tokens);

                return filenameResult || compliantResult;
            });
            setFilterTableData(dataFilter);
        }
    }, [filterString]);

    return (
        <>
            <div className="dashboard-details-table-container">
                <div className="details-table-container">
                    <div className="details-table-search-bar-container">
                        <SearchBar filterString={filterString} setFilterString={setFilterString} />
                    </div>
                    <UploadPcap isButton={true} />
                    <DetailsTableHOC
                        onRowClicked={onRowClicked}
                        onDoubleClick={onDoubleClick}
                        detailsTableData={filterTableData}
                        selectedPcapIds={selectedPcapIds}
                        detailsPcapsAnalysingData={pcapsAnalysing}
                    />
                </div>
            </div>
        </>
    );
};

export default DashboardTableView;
