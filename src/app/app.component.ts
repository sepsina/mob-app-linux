import {Component, OnInit, OnDestroy, NgZone} from '@angular/core';
import { EventsService } from './events.service';
import { UdpService } from './udp.service';
import { Validators, FormControl } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';

import * as gConst from './gConst';
//import * as gIF from './gIF';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy{

    selTypes = ['on-off actuators', 'temp sensors', 'humidity sensors'];
    typeCtrl = new FormControl(this.selTypes[0], Validators.required);
    selectedType = this.selTypes[0];

    g_const = gConst;

    udpBusy = false;
    itemsMap = new Map();

    constructor(public udp: UdpService,
                public events: EventsService,
                public ngZone: NgZone) {
        // ---
    }

    /***********************************************************************************************
     * fn          ngOnInit
     *
     * brief
     *
     */
    ngOnInit() {

        this.udpBusy = this.udp.rdCmd.busy;

        this.events.subscribe('newItem', (msg)=>{
            this.ngZone.run(()=>{
                this.itemsMap.set(msg.key, msg.value);
            });
        });
        window.onbeforeunload = ()=>{
            this.ngOnDestroy();
        };
        setTimeout(()=>{
            this.readSelected();
        }, 100);

    }

    /***********************************************************************************************
     * fn          ngOnDestroy
     *
     * brief
     *
     */
    ngOnDestroy() {
        this.udp.udpSocket.close();
    }

    /***********************************************************************************************
     * @fn          selChanged
     *
     * @brief
     *
     */
    selChanged(event: MatSelectChange){

        this.selectedType = event.value;
        console.log(this.selectedType);

        this.readSelected();
    }

    /***********************************************************************************************
     * @fn          readSelected
     *
     * @brief
     *
     */
    readSelected(){

        if(this.udpBusy == true){
            return;
        }

        this.itemsMap.clear();

        switch(this.selectedType){
            case 'on-off actuators': {
                this.udp.startRead(gConst.ON_OFF_ACTUATORS);
                break;
            }
            case 'temp sensors': {
                this.udp.startRead(gConst.T_SENSORS);
                break;
            }
            case 'humidity sensors': {
                this.udp.startRead(gConst.RH_SENSORS);
                break;
            }
            default:
                break;
        }
        console.log(`read ${this.selectedType}`);
    }

}
