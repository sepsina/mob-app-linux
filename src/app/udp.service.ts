
import { Injectable } from '@angular/core';
import { EventsService } from './events.service';
import { UtilsService } from './utils.service';

import * as gConst from './gConst';
import * as gIF from './gIF';

@Injectable({
    providedIn: 'root',
})
export class UdpService {

    private dgram: any;
    public udpSocket: any;

    private msgBuf = new ArrayBuffer(1024);
    private msg: DataView = new DataView(this.msgBuf);

    ipSet = new Set();

    rdCmd: gIF.rdCmd_t = {
        ip: [],
        busy: false,
        tmoRef: null,
        cmdID: 0,
        idx: 0,
        retryCnt: gConst.RD_CMD_RETRY_CNT,
    };

    constructor(private events: EventsService,
                private utils: UtilsService) {
        this.dgram = window.nw.require('dgram');
        this.udpSocket = this.dgram.createSocket('udp4');
        this.udpSocket.on('message', (msg: any, rinfo: any)=>{
            this.udpOnMsg(msg, rinfo);
        });
        this.udpSocket.on('error', (err: any)=>{
            console.log(`server error:\n${err.stack}`);
        });
        this.udpSocket.on('listening', ()=>{
            let address = this.udpSocket.address();
            console.log(`server listening ${address.address}:${address.port}`);
        });
        this.udpSocket.bind(gConst.UDP_PORT, ()=>{
            this.udpSocket.setBroadcast(true);
        });
    }

    /***********************************************************************************************
     * fn          udpOnMsg
     *
     * brief
     *
     */
    public udpOnMsg(msg: any, rem: any) {

        let msgBuf = this.utils.bufToArrayBuf(msg);
        let msgView = new DataView(msgBuf);

        let pktIdx = 0;
        let pktFunc = msgView.getUint16(pktIdx, gConst.LE);
        pktIdx += 2;
        switch(pktFunc) {
            case gConst.BRIDGE_ID_RSP: {
                this.ipSet.add(rem.address);
                break;
            }
            case gConst.ON_OFF_ACTUATORS: {
                let startIdx = msgView.getUint16(pktIdx, gConst.LE);
                pktIdx += 2;
                let numItems = msgView.getUint16(pktIdx, gConst.LE);
                pktIdx += 2;
                let doneFlag = msgView.getInt8(pktIdx);
                pktIdx++;
                for(let i = 0; i < numItems; i++) {
                    let item = {} as gIF.onOffItem_t;
                    item.hostIP = rem.address;
                    item.type = gConst.ACTUATOR_ON_OFF;
                    item.partNum = msgView.getUint32(pktIdx, gConst.LE);
                    pktIdx += 4;
                    item.extAddr = msgView.getFloat64(pktIdx, gConst.LE);
                    pktIdx += 8;
                    item.endPoint = msgView.getUint8(pktIdx);
                    pktIdx++;
                    item.state = msgView.getUint8(pktIdx);
                    pktIdx++;
                    item.level = msgView.getUint8(pktIdx);
                    pktIdx++;
                    let nameLen = msgView.getUint8(pktIdx);
                    pktIdx++;
                    let name = [];
                    for(let k = 0; k < nameLen; k++) {
                        name.push(msgView.getUint8(pktIdx));
                        pktIdx++;
                    }
                    item.name = String.fromCharCode.apply(String, name);

                    let key = this.itemKey(item.extAddr, item.endPoint);
                    this.events.publish('newItem', {key: key, value: item});
                }
                clearTimeout(this.rdCmd.tmoRef);
                if(doneFlag == 1) {
                    this.rdCmd.ip.shift();
                    if(this.rdCmd.ip.length > 0) {
                        this.rdCmd.idx = 0;
                        this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                        this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                        this.rdCmd.tmoRef = setTimeout(()=>{
                            this.rdCmdTmo();
                        }, gConst.RD_CMD_TMO);
                    }
                    else {
                        this.rdCmd.busy = false;
                    }
                }
                if(doneFlag == 0) {
                    this.rdCmd.idx = startIdx + numItems;
                    this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                    this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                    this.rdCmd.tmoRef = setTimeout(()=>{
                        this.rdCmdTmo();
                    }, gConst.RD_CMD_TMO);
                }
                break;
            }
            case gConst.BAT_VOLTS:
            case gConst.P_ATM_SENSORS:
            case gConst.RH_SENSORS:
            case gConst.T_SENSORS: {
                let startIdx = msgView.getUint16(pktIdx, gConst.LE);
                pktIdx += 2;
                let numItems = msgView.getUint16(pktIdx, gConst.LE);
                pktIdx += 2;
                let doneFlag = msgView.getInt8(pktIdx);
                pktIdx++;
                for(let i = 0; i < numItems; i++) {
                    let val: number;
                    let units: number;
                    let item = {} as gIF.sensorItem_t;
                    item.hostIP = rem.address;
                    item.type = gConst.SENSOR;
                    item.partNum = msgView.getUint32(pktIdx, gConst.LE);
                    pktIdx += 4;
                    item.extAddr = msgView.getFloat64(pktIdx, gConst.LE);
                    pktIdx += 8;
                    item.endPoint = msgView.getUint8(pktIdx);
                    pktIdx++;
                    switch(pktFunc) {
                        case gConst.T_SENSORS: {
                            val = msgView.getInt16(pktIdx, gConst.LE);
                            pktIdx += 2;
                            val = val / 10.0;
                            units = msgView.getUint16(pktIdx, gConst.LE);
                            pktIdx += 2;
                            if(units == gConst.DEG_F) {
                                item.formatedVal = `${val.toFixed(1)} °F`;
                            }
                            else {
                                item.formatedVal = `${val.toFixed(1)} °C`;
                            }
                            break;
                        }
                        case gConst.RH_SENSORS: {
                            val = msgView.getUint16(pktIdx, gConst.LE);
                            pktIdx += 2;
                            val = Math.round(val / 10.0);
                            item.formatedVal = `${val.toFixed(0)} %rh`;
                            break;
                        }
                        case gConst.P_ATM_SENSORS: {
                            val = msgView.getUint16(pktIdx, gConst.LE);
                            pktIdx += 2;
                            val = val / 10.0;
                            units = msgView.getUint16(pktIdx, gConst.LE);
                            pktIdx += 2;
                            if(units == gConst.IN_HG) {
                                item.formatedVal = `${val.toFixed(1)} inHg`;
                            }
                            else {
                                val = Math.round(val);
                                item.formatedVal = `${val.toFixed(1)} mBar`;
                            }
                            break;
                        }
                        case gConst.BAT_VOLTS: {
                            val = msgView.getUint16(pktIdx, gConst.LE);
                            pktIdx += 2;
                            val = val / 10.0;
                            item.formatedVal = `${val.toFixed(1)} V`;
                            break;
                        }
                    }
                    let nameLen = msgView.getUint8(pktIdx);
                    pktIdx++;
                    let name = [];
                    for(let k = 0; k < nameLen; k++) {
                        name.push(msgView.getUint8(pktIdx));
                        pktIdx++;
                    }
                    item.name = String.fromCharCode.apply(String, name);

                    let key = this.itemKey(item.extAddr, item.endPoint);
                    this.events.publish('newItem', {key: key, value: item});
                }
                clearTimeout(this.rdCmd.tmoRef);
                if(doneFlag == 1) {
                    this.rdCmd.ip.shift();
                    if(this.rdCmd.ip.length > 0) {
                        this.rdCmd.idx = 0;
                        this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                        this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                        this.rdCmd.tmoRef = setTimeout(()=>{
                            this.rdCmdTmo();
                        }, gConst.RD_CMD_TMO);
                    }
                    else {
                        this.rdCmd.busy = false;
                    }
                }
                if(doneFlag == 0) {
                    this.rdCmd.idx = startIdx + numItems;
                    this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                    this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                    this.rdCmd.tmoRef = setTimeout(()=>{
                        this.rdCmdTmo();
                    }, gConst.RD_CMD_TMO);
                }
                break;
            }
            default:
                // ---
                break;
        }
    }

    /***********************************************************************************************
     * fn          startRead
     *
     * brief
     *
     */
    public startRead(cmdID: number) {

        let idx = 0;
        this.msg.setUint16(idx, gConst.BRIDGE_ID_REQ, gConst.LE);
        idx += 2;
        let len = idx;
        let bufData = this.utils.arrayBufToBuf(this.msgBuf.slice(0, len));
        this.udpSocket.send(
            bufData,
            0,
            len,
            gConst.UDP_PORT,
            '192.168.1.255',
            (err)=>{
                if(err) {
                    console.log('get bridges err: ' + JSON.stringify(err));
                }
                else {
                    this.ipSet.clear();
                    this.rdCmd.cmdID = cmdID;
                    setTimeout(()=>{
                        this.readItems();
                    }, 500);
                }
            }
        );
    }

    /***********************************************************************************************
     * fn          readItems
     *
     * brief
     *
     */
    public readItems() {

        if(this.ipSet.size == 0) {
            return;
        }
        this.rdCmd.busy = true;
        this.rdCmd.ip = [...this.ipSet];
        this.rdCmd.idx = 0;
        this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
        this.rdCmd.tmoRef = setTimeout(()=>{
            this.rdCmdTmo();
        }, gConst.RD_CMD_TMO);

        this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
    }

    /***********************************************************************************************
     * fn          getItems
     *
     * brief
     *
     */
    public getItems(ip: string, idx: number) {

        let msgIdx = 0;
        this.msg.setUint16(msgIdx, this.rdCmd.cmdID, gConst.LE);
        msgIdx += 2;
        this.msg.setUint16(msgIdx, idx, gConst.LE);
        msgIdx += 2;
        let len = msgIdx;
        let bufData = this.utils.arrayBufToBuf(this.msgBuf.slice(0, len));
        this.udpSocket.send(
            bufData,
            0,
            len,
            gConst.UDP_PORT,
            ip,
            (err)=>{
                if(err) {
                    console.log('get items err: ' + JSON.stringify(err));
                }
            }
        );
    }

    /***********************************************************************************************
     * fn          rdCmdTmo
     *
     * brief
     *
     */
    rdCmdTmo() {

        console.log('--- READ_CMD_TMO ---');

        if(this.rdCmd.ip.length == 0) {
            this.rdCmd.busy = false;
            return;
        }
        if(this.rdCmd.retryCnt > 0) {
            this.rdCmd.retryCnt--;
            this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
            this.rdCmd.tmoRef = setTimeout(()=>{
                this.rdCmdTmo();
            }, gConst.RD_HOST_TMO);
        }
        if(this.rdCmd.retryCnt == 0) {
            this.rdCmd.ip.shift();
            if(this.rdCmd.ip.length > 0) {
                this.rdCmd.idx = 0;
                this.rdCmd.retryCnt = gConst.RD_CMD_RETRY_CNT;
                this.getItems(this.rdCmd.ip[0], this.rdCmd.idx);
                this.rdCmd.tmoRef = setTimeout(()=>{
                    this.rdCmdTmo();
                }, gConst.RD_CMD_TMO);
            }
            else {
                this.rdCmd.busy = false;
            }
        }
    }

    /***********************************************************************************************
     * fn          itemKey
     *
     * brief
     *
     */
    private itemKey(extAddr: number, endPoint: number) {

        const len = 8 + 1;
        const ab = new ArrayBuffer(len);
        const dv = new DataView(ab);
        let i = 0;
        dv.setFloat64(i, extAddr, gConst.LE);
        i += 8;
        dv.setUint8(i++, endPoint);
        let key = [];
        for (let i = 0; i < len; i++) {
            key[i] = dv.getUint8(i).toString(16);
        }
        return `item-${key.join('')}`;

        /*
        let key = `item-${shortAddr.toString(16).padStart(4, '0').toUpperCase()}`;
        key += `:${endPoint.toString(16).padStart(2, '0').toUpperCase()}`;

        return key;
        */
    }
}
