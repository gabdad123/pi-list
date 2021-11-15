import React from 'react';
import Select from 'react-select';
import { translate } from '../../utils/translation';
import list from '../../utils/api';
import './styles.scss';
import { TransitDelayIcon, AvSyncIcon, DiffTransitDelayIcon, NetworkRedundancyIcon } from 'components/icons/index';
import ItemsList from 'components/DropdownMenu/ItemsList';

interface IComponentProps {
    onCapture: (name: string, duration: number) => void;
    multipleSources: boolean;
}

function CapturePanel({
    onCapture,
    multipleSources,
}: IComponentProps) {
    const modes = [
        {
            value: 'parallel',
            label: 'Parallel',
        },
        {
            value: 'sequential',
            label: 'Sequential',
        },
    ];
    const [name, setName] = React.useState('');
    const [duration, setDuration] = React.useState('2000');
    const [mode, setMode] = React.useState(modes[0]);

    const onChangeName = (value: any) => { setName(value); };
    const onChangeDuration = (value: any) => { setDuration(value); };
    const onChangeMode = (value: any) => { setMode(value); };

    const onPressCapture = () => {
        onCapture(name, parseInt(duration));
    };

    return (
        <div className="capture-page-container">
            <div className="capture-container">
                <div className="capture-title">
                    <span>Capture Settings</span>
                </div>
                <div className="capture-content-row">
                    <div className="capture-page-select">
                        <div className="capture-settings-container">
                            <div className="capture-settings-label-container">
                                <span className="capture-settings-label">Name</span>
                            </div>
                            <input
                                type="text"
                                className="capture-panel-input"
                                value={name}
                                onChange={evt => onChangeName(evt.target.value)}
                            />
                        </div>
                    </div>
                    <div className="capture-page-select">
                        <div className="capture-settings-container">
                            <div className="capture-settings-label-container">
                                <span
                                className="capture-settings-label">Duration (ms)</span>
                            </div>
                            <input
                                type="text"
                                className="capture-panel-input"
                                value={duration}
                                onChange={evt => onChangeDuration(evt.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="capture-content-row">
                    <div className="capture-page-select">
                        <div className="capture-settings-container">
                            <div className="capture-settings-label-container">
                                <span className="capture-settings-label">Mode</span>
                            </div>
                            <Select
                                options={modes}
                                onChange={onChangeMode}
                                value={mode}
                                isDisabled={!multipleSources}
                            ></Select>
                        </div>
                    </div>
                    <div className="capture-page-select">
                        <button className="capture-page-capture-button" onClick={onPressCapture}>
                            Capture
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CapturePanel;
