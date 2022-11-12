
export interface rdCmd_t {
    ip: any;
    busy: boolean;
    tmoRef: any;
    cmdID: number;
    idx: number;
    retryCnt: number;
}

export interface sensorItem_t {
    hostIP: string;
    type: number;
    name: string;
    formatedVal: string;
    partNum: number;
    extAddr: number;
    endPoint: number;
}

export interface onOffItem_t {
    hostIP: string;
    type: number;
    name: string;
    state: number;
    level: number
    partNum: number;
    extAddr: number;
    endPoint: number;
}




