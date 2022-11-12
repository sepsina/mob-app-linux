import { Component, OnInit, Input } from '@angular/core';

import { UdpService } from '../udp.service';
import { UtilsService } from '../utils.service';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

@Component({
    selector: 'sensor',
    templateUrl: './sensor.component.html',
    styleUrls: ['./sensor.component.scss']
})
export class sensorComponent implements OnInit {

    @Input() sensor: gIF.sensorItem_t;

    formatedVal: string = '';

    private msgBuf = new ArrayBuffer(1024);
    private msg: DataView = new DataView(this.msgBuf);

    constructor(private udp: UdpService,
                private utils: UtilsService) {
        //---
    }

    /***********************************************************************************************
     * @fn          ngOnInit
     *
     * @brief
     *
     */
    ngOnInit(): void {
        // ---
    }

    /***********************************************************************************************
     * @fn          getName
     *
     * @brief
     *
     */
    getName(){
        return `${this.sensor.name}`;
    }

}
