'use strict'
const {
    HttpClient
} = require('hap-controller')

let Service, Characteristic, KnownServiceMap, KnownCharMap

function shortType(type){
    const parts = type.split('-')
    if (parts.length>0){
        let p = 0
        while (parts[0][p]==='0' && p<parts[0].length) {p++}
        return parts[0].substring(p)        
    }
}

function mapShort(list){
    return list.map(s => {
        return [
            {
                id  : s.UUID,
                cls : s
            },
            {
                id  : shortType(s.UUID),
                cls : s
            }
        ]        
    }).flat(1)
}

function buildServiceList(){
    KnownServiceMap = [    
        Service.HumiditySensor,
        Service.TemperatureSensor,
        Service.CarbonDioxideSensor,
        Service.CarbonMonoxideSensor,
        Service.AirQualitySensor,
        Service.ProtocolInformation,
        Service.AccessoryInformation,
        Service.Switch,
        Service.MotionSensor,
        Service.BatteryService,
        Service.Lightbulb,
        Service.Outlet,
        Service.LightSensor
    ]

    //mapping to the final data structure
    KnownServiceMap = mapShort(KnownServiceMap)
}

function buildCharMap(){
    KnownCharMap = [
        Characteristic.Identify,
        Characteristic.Manufacturer,
        Characteristic.Model,
        Characteristic.Name,
        Characteristic.SerialNumber,
        Characteristic.FirmwareRevision,
        Characteristic.HardwareRevision,
        Characteristic.ProductData,
        Characteristic.Version,
        Characteristic.IsConfigured,
        Characteristic.AirQuality,
        Characteristic.PM2_5Density,
        Characteristic.PM10Density,
        Characteristic.CarbonDioxideDetected,
        Characteristic.CarbonDioxideLevel,
        Characteristic.CarbonDioxidePeakLevel,
        Characteristic.CarbonMonoxideDetected,
        Characteristic.CarbonMonoxideLevel,
        Characteristic.CarbonMonoxidePeakLevel,
        Characteristic.CurrentTemperature,
        Characteristic.CurrentRelativeHumidity,
        Characteristic.On,
        Characteristic.OutletInUse,
        Characteristic.MotionDetected,
        Characteristic.StatusLowBattery,
        Characteristic.BatteryLevel,
        Characteristic.Brightness,
        Characteristic.Hue,
        Characteristic.ColorTemperature,
        Characteristic.Saturation,
        Characteristic.CurrentAmbientLightLevel
    ]

    //mapping to the final data structure
    KnownCharMap = mapShort(KnownCharMap)        
    
}

function classFromID(list, id){       
    const result = list.find(item => item.id ===id)    
    if (result) {return result.cls}
    return undefined
}

function classForService(type){
    return classFromID(KnownServiceMap, type)
}

function classForChar(type){
    return classFromID(KnownCharMap, type)
}

class HKClient {
    constructor(serviceConfig, parent) {
        this.parent = parent     
        this.serviceConfig = serviceConfig  
        
        //state
        this.didFinishWasDefered = false
        this.didFinishStartup = false
        this.accesoriesWereLoaded = false

        //data
        this.supportedAccessories = []    
        this.uuid = parent.api.hap.uuid.generate(serviceConfig.name)
        this.name = serviceConfig.name

        const self = this

        const client = new HttpClient(
            serviceConfig.id,
            serviceConfig.address,
            serviceConfig.port,
            serviceConfig.pairingData
        )
        this.mainClient = client
        

        client.getAccessories().then((data) => {
            self.accesoriesWereLoaded = true
            this.supportedAccessories = data.accessories.map(acc=> acc.services.map(s => {
                return {
                    create:classForService(s.type),
                    uname:`${this.uuid}.${acc.aid}.${s.iid}`,
                    characteristics:s.characteristics.map(c => 
                    {
                        return {
                            create: classForChar(c.type),
                            uname:`${this.uuid}.${acc.aid}.${s.iid}.${c.iid}`,  
                            cname:`${acc.aid}.${c.iid}`,
                            value: c.value,
                            source:c
                        }
                    }),
                    source:s
                }
            })) 
                    

            if (this.didFinishWasDefered) {
                this.didFinishWasDefered = false
                this.didFinishLaunching()
            }
        }).catch((e) => {
            self.parent.log.error('Error', e)
        })
       

        parent.api.on('didFinishLaunching', () => {
            if (self.accesoriesWereLoaded) {
                self.didFinishLaunching()
            } else {
                this.didFinishWasDefered = true
            }
        })
    }    

    con(){
        return new HttpClient(
            this.serviceConfig.id,
            this.serviceConfig.address,
            this.serviceConfig.port,
            this.serviceConfig.pairingData
        )
    }

    copyProps(source, char){
        const props = {}

        if (source.minValue !== undefined) {props.minValue = source.minValue}
        if (source.maxValue !== undefined) {props.maxValue = source.maxValue}
        if (source.minStep !== undefined) {props.minStep = source.minStep}
        if (source.format !== undefined) {props.format = source.format}
        if (source.perms !== undefined) {props.perms = source.perms}
        if (source.unit !== undefined) {props.unit = source.unit}
        if (source.description !== undefined) {props.description = source.description}
        if (source.maxLen !== undefined) {props.maxLen = source.maxLen}
        if (source.maxDataLen !== undefined) {props.maxDataLen = source.maxDataLen}
        if (source.validValues !== undefined) {props.validValues = source.validValues}
        if (source.validValueRanges !== undefined) {props.validValueRanges = source.validValueRanges}
        if (source.adminOnlyAccess !== undefined) {props.adminOnlyAccess = source.adminOnlyAccess}
                                        
        char.setProps(props)
    }
    
    initAccessoryService(sData, service){
        const self = this

        sData.characteristics.forEach((c) => {                    
            service.setCharacteristic(c.create, c.source.value)
            const char = service.getCharacteristic(c.create)
            self.copyProps(c.source, char)
            
            if (c.source.perms && c.source.perms.indexOf('pr')>=0){                                                
                char.on('get', (callback) => {
                    this.con().getCharacteristics(
                        [c.cname],
                        {
                            meta: true,
                            perms: true,
                            type: true,
                            ev: true,
                        }
                    ).then((data) => {
                        c.value = data.characteristics[0].value
                        char.updateValue(c.value)                                
                    }).catch((e) => this.parent.log.error('get', c.cname, e))

                    callback(null, c.value)
                })                                            
            }

            if (c.source.perms && (c.source.perms.indexOf('pw')>=0 | c.source.perms.indexOf('tw')>=0)){
                char.on('set', (value, callback) => {
                    const data = {}
                    data[c.name] = value
                    
                    this.con().setCharacteristics(data).then(() => {
                        c.value = value                            
                    }).catch((e) => this.parent.log.error('set', c.cname, e))

                    callback(null)
                })
            }

            if (c.source.perms && (c.source.perms.indexOf('ev')>=0)){
                const cl = this.con()
                cl.on('event', event => {
                    if (event.characteristics && event.characteristics.length>0){
                        const data = event.characteristics[0]
                        
                        if (c.cname === `${data.aid}.${data.iid}` && data.value) {
                            {this.parent.log.debug('Got Event', c.cname, data.value)}
                            char.updateValue(data.value)                                
                        }
                    }
                })

                cl.subscribeCharacteristics([c.cname]).then((conn) => {
                    this.parent.log.debug(c.cname, 'Subscribed to events')
                    c.connection = conn                            
                }).catch((e) => console.error(e))
            }                    
        })
    }

    loadOrCreate(accessoryServices){
        const self = this
        //console.log(accessoryServices)
        
        const configuredAcc = this.parent.accessories.find(accessory => accessory.UUID === this.uuid)
        // check the accessory was not restored from cache
        if (configuredAcc === undefined) {
            // create a new accessory
            const accessory = new this.parent.api.platformAccessory(this.name, this.uuid)
            accessoryServices.map(sData => {
                let service = accessory.getService(sData.create)

                if (!service) {
                    service = accessory.addService(sData.create)
                }
                
                self.initAccessoryService(sData, service)                
            })

            // register the accessory
            this.parent.api.registerPlatformAccessories('homebridge-homekit-controller', 'HomeKitController', [accessory])            
        } else {
            accessoryServices.map(sData => {
                let service = configuredAcc.getService(sData.create)

                if (!service) {
                    service = configuredAcc.addService(sData.create)
                }
                
                self.initAccessoryService(sData, service)                
            })
            configuredAcc._wasUsed = true
        }


        // const uuid = this.parent.api.hap.uuid.generate(accessoryServices.uname)
        // // console.log(uuid, accessoryItem.uname)
    }

    didFinishLaunching() {  
        const self = this  

        this.supportedAccessories.forEach(acc => self.loadOrCreate(acc))  
        // const uuid = this.api.hap.uuid.generate('SOMETHING UNIQUE');

        // // check the accessory was not restored from cache
        // if (!this.accessories.find(accessory => accessory.UUID === uuid)) {

        //     // create a new accessory
        //     const accessory = new this.api.platformAccessory('DISPLAY NAME', uuid);

        //     // register the accessory
        //     this.api.registerPlatformAccessories('PLUGIN_NAME', 'PLATFORM_NAME', [accessory]);
        // }

        this.didFinishStartup = true
        this.parent.clientFinishedLaunching(self)
    }
}

class HKPlatform {    
    constructor(log, config, api) {
        this.config = config
        this.api = api
        this.log = log
        this.accessories = []

        const self = this
        this.clients = this.config.services.map(serviceConfig => new HKClient(serviceConfig, self))        
    }

    /**
     * REQUIRED - Homebridge will call the "configureAccessory" method once for every cached
     * accessory restored
     */
    configureAccessory(accessory) {
        accessory._wasUsed = false
        this.accessories.push(accessory)
    }

    clientFinishedLaunching(cl){
        const allReady = this.clients.map(c => c.didFinishStartup).filter(ok => !ok).length===0
        this.log(`${cl.name} finished Startup. ${allReady?'All Clients ready now':''}`)

        if (allReady){
            const unused = this.accessories.filter(a => a._wasUsed===false)
            this.log(`Found ${unused.length} unused accessories`)
            this.log(unused)
            if (process.argv.some(v=>v==='-Q')){
                this.log('Deleting unused accessories')
            }
        }
    }
}

module.exports = function (service, characteristic) {
    Service = service
    Characteristic = characteristic

    buildServiceList()
    buildCharMap()

    return {
        HKPlatform: HKPlatform
    }
}