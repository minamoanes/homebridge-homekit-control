'use strict'
const {HttpClient} = require('hap-controller'),
    inherits = require('util').inherits
    

let Service, Characteristic, KnownServiceMap, KnownCharMap, FakeGatoService, CustomCharacteristic

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
        Characteristic.CurrentAmbientLightLevel,
        Characteristic.AirParticulateDensity,
        Characteristic.ChargingState
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
        this.deviceID = serviceConfig.name
        
        //state
        this.didFinishWasDefered = false
        this.didFinishStartup = false
        this.accesoriesWereLoaded = false

        //data
        this.supportedAccessories = []    
        if (serviceConfig.uniquePrefix){
            this.uuid = parent.api.hap.uuid.generate(`${serviceConfig.uniquePrefix}.${serviceConfig.name}`)
        } else {
            this.uuid = parent.api.hap.uuid.generate(serviceConfig.name)
        }
        this.name = serviceConfig.name?serviceConfig.name:'Unnamed Accessory'
        this.fakeGato = { 
            users:[],
            interval: 0,
            timer: undefined
        }

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
                    }).filter(c => {
                        if (c.create === undefined){
                            this.parent.log.warn(`Missing Type ${c.source.type}`)
                            return false
                        }
                        return true
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

        if (serviceConfig.historyInterval > 0){
            this.fakeGato.interval = Math.max(30, Math.min(600, serviceConfig.historyInterval))            
        }
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

    _updateCharacteristicValue(char, c){
        if (!c.allowValueUpdates) {return}
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
            this.parent.log('Received Value', c.cname, c.value)
            
            char.updateValue(c.value)                                
        }).catch((e) => this.parent.log.error('get', c.cname, e))
    }

    _setCharacteristicValue(char, value, c){
        const data = {}
        data[c.name] = value
                    
        this.con().setCharacteristics(data).then(() => {
            c.value = value 
            this.parent.log('Wrote Value', c.cname, c.value)                           
        }).catch((e) => this.parent.log.error('set', c.cname, e))
    }
    
    initAccessoryService(sData, service){
        const self = this

        sData.characteristics.forEach((c) => {   
            c.allowValueUpdates = true            
            if (c.create.UUID === Characteristic.SerialNumber.UUID && this.serviceConfig.uniquePrefix){
                this.deviceID = c.value
                c.allowValueUpdates = false                
                c.value = `${this.serviceConfig.uniquePrefix}-${this.deviceID}`
            } else if (c.create.UUID === Characteristic.Name.UUID && this.serviceConfig.name){
                c.allowValueUpdates = false                
                c.value = this.serviceConfig.name
            } 

            if (c.source.value !== undefined) {
                service.setCharacteristic(c.create, c.value)
            }
            const char = service.getCharacteristic(c.create)
            c.connect = char
            self.copyProps(c.source, char)

            
            
            
            if (c.source.perms && c.source.perms.indexOf('pr')>=0){                                                
                char.on('get', (callback) => {                    
                    self._updateCharacteristicValue(char, c)                                        
                    callback(null, c.value)
                })                                            
            }

            if (c.source.perms && (c.source.perms.indexOf('pw')>=0 | c.source.perms.indexOf('tw')>=0)){
                char.on('set', (value, callback) => {
                    self._setCharacteristicValue(char, value, c)                    
                    callback(null)
                })
            }

            if (c.allowValueUpdates && c.source.perms && (c.source.perms.indexOf('ev')>=0)){
                const cl = this.con()
                cl.on('event', event => {
                    if (event.characteristics && event.characteristics.length>0){
                        const data = event.characteristics[0]
                        
                        if (c.cname === `${data.aid}.${data.iid}` && data.value) {
                            this.parent.log.debug(`Got Event for ${c.cname}. Changed value ${c.value} => ${data.value}`)

                            c.value = data.value
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
            this.parent.log.debug(`Building new Accessory ${accessory.displayName} (${accessory.UUID})`)
            accessoryServices.map(sData => {
                let service = accessory.getService(sData.create)

                if (!service) {
                    service = accessory.addService(sData.create)
                }
                
                self.initAccessoryService(sData, service)                
            })
            self.addFakeGatoService(accessoryServices.fakeGato, accessory)

            // register the accessory
            this.parent.api.registerPlatformAccessories('homebridge-homekit-controller', 'HomeKitController', [accessory])            
        } else {
            this.parent.log.debug(`Reconfiguring existing Accesory ${configuredAcc.displayName} (${configuredAcc.UUID})`)
            accessoryServices.map(sData => {
                let service = configuredAcc.getService(sData.create)

                if (!service) {
                    service = configuredAcc.addService(sData.create)
                }
                
                self.initAccessoryService(sData, service)
            })
            self.addFakeGatoService(accessoryServices.fakeGato, configuredAcc)

            configuredAcc._wasUsed = true
        }
    }

    didFinishLaunching() {  
        const self = this   
        if (this.fakeGato.interval > 0){
            this.amendFakeGato()
        }       

        this.supportedAccessories.forEach(acc => self.loadOrCreate(acc))          
        this.didFinishStartup = true
        this.parent.clientFinishedLaunching(self)

        if (this.fakeGato.interval > 0) {
            this.parent.log(`Enabeling History Log for '${this.name}' every ${this.fakeGato.interval} seconds`)            
            
            this.fakegatoEvent()
            this.fakeGato.timer = setInterval(self.fakegatoEvent.bind(self), this.fakeGato.interval*1000)
        }
    }  

    amendFakeGato(){
        if (this.fakeGato.interval<=0) {return}
        this.supportedAccessories.forEach(acc =>{
            const has = function(type, cType) {
                const s = acc.find(s => s.create.UUID === type.UUID)
                if (cType && s){
                    return s.characteristics.find(c => c.create.UUID == cType.UUID)
                }
                return s
            }

            acc.fakeGato = {
                room:{
                    temp:has(Service.TemperatureSensor, Characteristic.CurrentTemperature),
                    humidity:has(Service.HumiditySensor, Characteristic.CurrentRelativeHumidity),
                    ppm:[has(Service.CarbonDioxideSensor, Characteristic.CarbonDioxideLevel), has(Service.AirQualitySensor, Characteristic.PM2_5Density), has(Service.AirQualitySensor, Characteristic.PM10Density), has(Service.CarbonMonoxideSensor, Characteristic.CarbonMonoxideLevel), ].find(i=>i!==undefined)
                },
                motion:{
                    status:has(Service.MotionSensor, Characteristic.MotionDetected)
                }
            }

            acc.fakeGato.history = []
            if (acc.fakeGato.room.temp && acc.fakeGato.room.humidity && acc.fakeGato.room.ppm){
                acc.fakeGato.history.push({'type':'room', data:acc.fakeGato.room, logService:undefined})
            } else if (acc.fakeGato.room.temp && acc.fakeGato.room.humidity){
                acc.fakeGato.history.push({'type':'weather', data:{temp:acc.fakeGato.room.temp, humidity:acc.fakeGato.room.humidity}, logService:undefined})
            } else if (acc.fakeGato.motion.status){
                acc.fakeGato.history.push({'type':'motion', data:acc.fakeGato.motion, logService:undefined})
            }
        })
    }


    addFakeGatoService(fakeGato, accessory){
        //add the fakeGato service if needed
        if (fakeGato && this.fakeGato.interval > 0){            
            accessory.log = this.parent.log
            fakeGato.history.forEach(h => {
                const airQualityService = accessory.getService(Service.AirQualitySensor)
                
                if (airQualityService && h.type==='room') {                                       
                    let airQualityC = airQualityService.getCharacteristic(CustomCharacteristic.AirQuality)
                    
                    let valueGetter = () => {
                        if(h.data.ppm.UUID === Characteristic.PM2_5Density || h.data.ppm.UUID === Characteristic.PM10Density){
                            //sems to be ug/m3 not ppm => convert like https://github.com/simont77/fakegato-history/issues/107
                            return Math.max(500, h.data.ppm.value / 4.57)
                        } else {
                            return Math.max(500, h.data.ppm.value)
                        }
                    }
                    if (airQualityC===undefined) {
                        this.parent.log.debug(`Adding Eve PPM Characteristic to '${this.name}', ${this.deviceID}, ${this.serviceConfig.uniquePrefix?this.serviceConfig.uniquePrefix:''} = ${valueGetter()}`)
                        airQualityC = airQualityService.setCharacteristic(CustomCharacteristic.AirQuality, valueGetter())
                    } else {
                        this.parent.log.debug(`Updating initial value for Eve PPM Characteristic to ${valueGetter()}`)
                        airQualityC.updateValue(valueGetter())
                    }

                    airQualityC.onGet(async ()=> valueGetter())
                }
                
                h.logService = accessory.getService(FakeGatoService)
                if (h.logService === undefined){
                    this.parent.log.debug(`Adding FakeGatoService '${h.type}' to '${this.name}', ${this.deviceID}, ${this.serviceConfig.uniquePrefix?this.serviceConfig.uniquePrefix:''}`)
                    h.logService = new FakeGatoService(h.type, accessory, {size:4000,disableTimer:true})                    
                }
            })
        }
    }

    fakegatoEvent(){
        const self = this
        this.parent.log('Timer - ', this.name)

        this.supportedAccessories.filter(acc=> acc.fakeGato && acc.fakeGato.history.length>0).forEach(acc => {
            acc.fakeGato.history.forEach(h => {
                const data = {
                    time: Math.round(new Date().valueOf() / 1000)
                }
                Object.keys(h.data).forEach(k=> {
                    const c = h.data[k]
                    
                    if (k==='ppm') {
                        data[k] = Math.max(500, c.value)
                    } else {
                        data[k] = c.value
                    }
                    
                    //no auto updates, so trigger manual reads
                    //if (c.source.perms && (c.source.perms.indexOf('ev')<0))
                    {
                        this.parent.log('FakeGato Triggered Value read', c.cname)
                        self._updateCharacteristicValue(c.connect, c)
                    }
                })
                
                console.log(h.type, data)
                h.logService.addEntry(data)
            })
            
        })
    }
}

class HKPlatform {    
    constructor(log, config, api) {
        this.config = config
        this.api = api
        this.log = log
        
        this.accessories = []
        const self = this        
        
        this.clients = this.config.services===undefined?[]:this.config.services.map(serviceConfig => new HKClient(serviceConfig, self))  
        
        this.api.on('didFinishLaunching', () => {
            if (this.clients.length===0){
                this.clientFinishedLaunching(undefined)
            }  
        })
         
                
    }

    /**
     * REQUIRED - Homebridge will call the "configureAccessory" method once for every cached
     * accessory restored
     */
    configureAccessory(accessory) {
        this.log.debug(`Loaded Accesory ${accessory.displayName} (${accessory.UUID})`)
        accessory._wasUsed = false
        this.accessories.push(accessory)
    }

    clientFinishedLaunching(cl){
        const allReady = this.clients.map(c => c.didFinishStartup).filter(ok => !ok).length===0
        if (cl!==undefined){
            this.log(`${cl.name} finished Startup. ${allReady?'All Clients ready now':''}`)
        } else if (allReady) {
            this.log.debug('All Clients ready now')
        }

        if (allReady){
            this.log.debug('Loaded Accesories')
            this.log.debug(this.accessories.map(a => ` - [${a._wasUsed?'X':' '}] ${a.displayName} (${a.UUID})`).join('\n'))
            const unused = this.accessories.filter(a => a._wasUsed===false)
            this.log(`Found ${unused.length} unused accessories`)
            
            if (process.argv.some(v=>v==='-Q')){
                this.log('Deleting unused accessories')  
                unused.forEach(a => this.api.unregisterPlatformAccessories('homebridge-homekit-controller', 'HomeKitController', [a]))
            }            
        }
    }
}

module.exports = function (service, characteristic, homebridge) {
    Service = service
    Characteristic = characteristic
    FakeGatoService = require('fakegato-history')(homebridge)


    
    CustomCharacteristic={}
    CustomCharacteristic.AirQuality = function () {
        Characteristic.call(this, 'Air Quality PM25', 'E863F10B-079E-48FF-8F27-9C2605A29F52')
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: 'ppm',
            maxValue: 99999,
            minValue: 500,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        })
        this.value = this.getDefaultValue()
    }
    CustomCharacteristic.AirQuality.UUID = 'E863F10B-079E-48FF-8F27-9C2605A29F52'
    CustomCharacteristic.AirQuality.uuid = 'E863F10B-079E-48FF-8F27-9C2605A29F52'
    
    inherits(CustomCharacteristic.AirQuality, Characteristic)


    buildServiceList()
    buildCharMap()

    return {
        HKPlatform: HKPlatform
    }
}