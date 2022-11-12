import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AngularMaterialModule } from './angular-material/angular-material.module';

import { AppComponent } from './app.component';
import { ssrComponent } from './ssr/ssr.component';
import { sensorComponent } from './sensor/sensor.component';


@NgModule({
    declarations: [
        AppComponent,
        ssrComponent,
        sensorComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        AngularMaterialModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
