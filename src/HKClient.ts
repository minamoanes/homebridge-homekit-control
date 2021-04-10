import { PlatformAccessory, Service, Characteristic, CharacteristicProps, WithUUID, APIEvent } from 'homebridge'
import {
    AcceessoryDescription,
    CharacteristicDescription,
    ExtendedCharacteristic,
    FakeGatoProvider,
    HKServiceConfig,
    HttpClientAccesory,
    HttpClientCharacteristic,
    HttpClientService,
    IHKClient,
    IHKPlatform,
    ServiceDescription,
} from './Interfaces'
import { HttpClient } from 'hap-controller'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import { Accessories } from 'hap-controller/lib/transport/ble/gatt-client'

interface FakeGatoData {
    interval: number
    timer: NodeJS.Timer | undefined
}

function copyProps(source: HttpClientCharacteristic, char: ExtendedCharacteristic) {
    const props: Partial<CharacteristicProps> = {
        perms: [],
        format: '',
    }

    if (source.minValue !== undefined) {
        props.minValue = source.minValue
    }
    if (source.maxValue !== undefined) {
        props.maxValue = source.maxValue
    }
    if (source.minStep !== undefined) {
        props.minStep = source.minStep
    }
    if (source.format !== undefined) {
        props.format = source.format
    }
    if (source.perms !== undefined) {
        props.perms = source.perms as any
    }
    if (source.unit !== undefined) {
        props.unit = source.unit
    }
    if (source.description !== undefined) {
        props.description = source.description
    }
    if (source.maxLen !== undefined) {
        props.maxLen = source.maxLen
    }
    if (source.maxDataLen !== undefined) {
        props.maxDataLen = source.maxDataLen
    }
    if (source.validValues !== undefined) {
        props.validValues = source.validValues
    }
    if (source.validValueRanges !== undefined) {
        props.validValueRanges = source.validValueRanges
    }
    if (source.adminOnlyAccess !== undefined) {
        props.adminOnlyAccess = source.adminOnlyAccess as any
    }
    char.setProps(props)
}

export class HKClient implements IHKClient {
    private readonly serviceConfig: HKServiceConfig
    private readonly parent: IHKPlatform
    private deviceID: string
    private readonly uuid: string

    readonly name: string
    private didFinishWasDefered: boolean = false
    private accesoriesWereLoaded: boolean = false
    public didFinishStartup: boolean = false

    private supportedAccessories: AcceessoryDescription[]
    private readonly fakeGato: FakeGatoData
    constructor(serviceConfig: HKServiceConfig, parent: IHKPlatform) {
        this.parent = parent
        this.serviceConfig = serviceConfig
        this.name = serviceConfig.name ? serviceConfig.name : 'Unnamed Accessory'
        this.deviceID = this.name

        //data
        this.supportedAccessories = []
        if (serviceConfig.uniquePrefix) {
            this.uuid = parent.api.hap.uuid.generate(`${serviceConfig.uniquePrefix}.${this.name}`)
        } else {
            this.uuid = parent.api.hap.uuid.generate(this.name)
        }

        this.fakeGato = {
            interval: 0,
            timer: undefined,
        }

        const self = this

        this.con()
            .getAccessories()
            .then((inData: any) => {
                //looks like this Gatt-Result is the actual return type for httpClient as well
                const data = inData as Accessories

                self.accesoriesWereLoaded = true
                this.supportedAccessories = data.accessories.map((acc: HttpClientAccesory) => {
                    const aRes: AcceessoryDescription = {
                        fakeGato: {
                            room: {},
                            motion: {},
                            history: [],
                        },
                        services: acc.services.map((s: HttpClientService) => {
                            const sRes: ServiceDescription = {
                                create: this.parent.supported.classForService(s.type),
                                uname: `${this.uuid}.${acc.aid}.${s.iid}`,
                                characteristics: s.characteristics
                                    .map((c: HttpClientCharacteristic) => {
                                        const cRes: CharacteristicDescription = {
                                            create: this.parent.supported.classForChar(c.type),
                                            uname: `${this.uuid}.${acc.aid}.${s.iid}.${c.iid}`,
                                            cname: `${acc.aid}.${c.iid}`,
                                            value: c.value,
                                            source: c,
                                            connect: undefined,
                                            allowValueUpdates: true,
                                        }
                                        return cRes
                                    })
                                    .filter((c) => {
                                        if (c.create === undefined) {
                                            this.parent.log.warn(`Missing Type ${c.source.type}`)
                                            return false
                                        }
                                        return true
                                    }),
                                source: s,
                            }
                            return sRes
                        }),
                    }
                    return aRes
                })

                if (this.didFinishWasDefered) {
                    this.didFinishWasDefered = false
                    this.didFinishLaunching()
                }
            })
            .catch((e) => {
                self.parent.log.error('Error', e)
            })

        parent.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            if (self.accesoriesWereLoaded) {
                self.didFinishLaunching()
            } else {
                this.didFinishWasDefered = true
            }
        })

        if (serviceConfig.historyInterval > 0) {
            this.fakeGato.interval = Math.max(30, Math.min(600, serviceConfig.historyInterval))
        }
    }

    con(): HttpClient {
        return new HttpClient(this.serviceConfig.id, this.serviceConfig.address, this.serviceConfig.port, this.serviceConfig.pairingData)
    }

    private _updateCharacteristicValue(char: ExtendedCharacteristic, c: CharacteristicDescription) {
        if (!c.allowValueUpdates) {
            return
        }
        this.con()
            .getCharacteristics([c.cname], {
                meta: true,
                perms: true,
                type: true,
                ev: true,
            })
            .then((inData: any) => {
                const data = inData as HttpClientService
                c.value = data.characteristics[0].value
                this.parent.log.debug('Received Value', c.cname, c.value)
                char.updateValue(c.value)

                if (char.chain && char.chainValue) {
                    this.parent.log.debug(` ==> Chain received value from ${c.cname} to ${char.chain.displayName} (Value=${char.chainValue()})`)
                    char.chain.updateValue(char.chainValue())
                }
            })
            .catch((e) => this.parent.log.error('get', c.cname, e))
    }

    private _setCharacteristicValue(char: ExtendedCharacteristic, value: any, c: CharacteristicDescription) {
        const data = {}
        data[c.cname] = value

        this.con()
            .setCharacteristics(data)
            .then(() => {
                c.value = value
                this.parent.log.info('Wrote Value', c.cname, c.value)
            })
            .catch((e) => this.parent.log.error('set', c.cname, e))
    }

    private initAccessoryService(sData: ServiceDescription, service: Service) {
        const self = this

        sData.characteristics.forEach((c) => {
            c.allowValueUpdates = true
            if (c.create) {
                if (c.create.UUID === this.parent.api.hap.Characteristic.SerialNumber.UUID && this.serviceConfig.uniquePrefix) {
                    this.deviceID = c.value
                    c.allowValueUpdates = false
                    c.value = `${this.serviceConfig.uniquePrefix}-${this.deviceID}`
                } else if (c.create.UUID === this.parent.api.hap.Characteristic.Name.UUID && this.serviceConfig.name) {
                    c.allowValueUpdates = false
                    c.value = this.serviceConfig.name
                }

                if (c.source.value !== undefined) {
                    service.setCharacteristic(c.create, c.value)
                }
                const char = service.getCharacteristic(c.create) as ExtendedCharacteristic
                c.connect = char
                copyProps(c.source, char)

                if (c.source.perms && c.source.perms.indexOf('pr') >= 0) {
                    char.on('get', (callback) => {
                        self._updateCharacteristicValue(char, c)
                        callback(null, c.value)
                    })
                }

                if ((c.source.perms && c.source.perms.indexOf('pw') >= 0) || c.source.perms.indexOf('tw') >= 0) {
                    char.on('set', (value, callback) => {
                        self._setCharacteristicValue(char, value, c)
                        callback(null)
                    })
                }

                if (c.allowValueUpdates && c.source.perms && c.source.perms.indexOf('ev') >= 0) {
                    const cl = this.con()
                    cl.on('event', (event) => {
                        if (event.characteristics && event.characteristics.length > 0) {
                            const data = event.characteristics[0]

                            if (c.cname === `${data.aid}.${data.iid}` && data.value) {
                                this.parent.log.debug(`Got Event for ${c.cname}. Changed value ${c.value} => ${data.value}`)

                                c.value = data.value
                                char.updateValue(data.value)

                                if (char.chain && char.chainValue) {
                                    this.parent.log.debug(` ==> Chain event from ${c.cname} to ${char.chain.displayName} (Value=${char.chainValue()})`)
                                    char.chain.updateValue(char.chainValue())
                                }
                            }
                        }
                    })

                    cl.subscribeCharacteristics([c.cname])
                        .then((conn) => {
                            this.parent.log.debug(c.cname, 'Subscribed to events')
                            c.connection = conn
                        })
                        .catch((e) => console.error(e))
                }
            } else {
                this.parent.log.warn(`Unable to create Characteristic ${c.uname} of type ${c.source.type}`)
            }
        })
    }
    private _serviceCreator(sData: ServiceDescription, accessory: PlatformAccessory) {
        if (sData.create) {
            let service: Service | undefined = accessory.getService(sData.create as any)

            if (!service) {
                service = new sData.create()
                service = accessory.addService(service)
            }

            if (service) {
                this.initAccessoryService(sData, service)
                return
            }
        }
        this.parent.log.warn(`Unable to create Service ${sData.uname} of type ${sData.source.type}`)
    }

    private loadOrCreate(accessoryServices: AcceessoryDescription) {
        const self = this

        const configuredAcc = this.parent.accessories.find((accessory) => accessory.UUID === this.uuid)
        // check the accessory was not restored from cache
        if (configuredAcc === undefined) {
            // create a new accessory
            const accessory = new this.parent.api.platformAccessory(this.name, this.uuid)
            this.parent.log.debug(`Building new Accessory ${accessory.displayName} (${accessory.UUID})`)
            accessoryServices.services.map((sData: ServiceDescription) => self._serviceCreator(sData, accessory))
            this.addAditionalServices(accessoryServices, accessory)

            // register the accessory
            this.parent.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
        } else {
            this.parent.log.debug(`Reconfiguring existing Accesory ${configuredAcc.displayName} (${configuredAcc.UUID})`)
            accessoryServices.services.map((sData: ServiceDescription) => self._serviceCreator(sData, configuredAcc))
            this.addAditionalServices(accessoryServices, configuredAcc)

            configuredAcc._wasUsed = true
        }
    }

    didFinishLaunching() {
        const self = this
        if (this.fakeGato.interval > 0) {
            this.amendFakeGato()
        }

        this.supportedAccessories.forEach((acc) => self.loadOrCreate(acc))
        this.didFinishStartup = true
        this.parent.clientFinishedLaunching(self)

        if (this.fakeGato.interval > 0) {
            this.parent.log(`Enabeling History Log for '${this.name}' every ${this.fakeGato.interval} seconds`)

            this.fakegatoEvent()
            this.fakeGato.timer = setInterval(self.fakegatoEvent.bind(self), this.fakeGato.interval * 1000)
        }
    }

    protected addAditionalServices(accessoryServices: AcceessoryDescription, accesory: PlatformAccessory) {
        this.addFakeGatoService(accessoryServices.fakeGato, accesory)
    }

    private _findTempService(has: (type: WithUUID<new () => Service>, cType: WithUUID<new () => Characteristic>) => CharacteristicDescription | undefined): CharacteristicDescription | undefined {
        return has(this.parent.api.hap.Service.TemperatureSensor, this.parent.api.hap.Characteristic.CurrentTemperature)
    }

    private _findHumidityService(has: (type: WithUUID<new () => Service>, cType: WithUUID<new () => Characteristic>) => CharacteristicDescription | undefined): CharacteristicDescription | undefined {
        return has(this.parent.api.hap.Service.HumiditySensor, this.parent.api.hap.Characteristic.CurrentRelativeHumidity)
    }

    private _findPPMService(has: (type: WithUUID<new () => Service>, cType: WithUUID<new () => Characteristic>) => CharacteristicDescription | undefined): CharacteristicDescription | undefined {
        return [
            has(this.parent.api.hap.Service.CarbonDioxideSensor, this.parent.api.hap.Characteristic.CarbonDioxideLevel),
            has(this.parent.api.hap.Service.AirQualitySensor, this.parent.api.hap.Characteristic.PM2_5Density),
            has(this.parent.api.hap.Service.AirQualitySensor, this.parent.api.hap.Characteristic.PM10Density),
            has(this.parent.api.hap.Service.CarbonMonoxideSensor, this.parent.api.hap.Characteristic.CarbonMonoxideLevel),
        ].find((i) => i !== undefined)
    }

    private _findMotionService(has: (type: WithUUID<new () => Service>, cType: WithUUID<new () => Characteristic>) => CharacteristicDescription | undefined): CharacteristicDescription | undefined {
        return has(this.parent.api.hap.Service.MotionSensor, this.parent.api.hap.Characteristic.MotionDetected)
    }

    amendFakeGato() {
        const self = this
        if (this.fakeGato.interval <= 0) {
            return
        }
        this.supportedAccessories.forEach((acc: AcceessoryDescription) => {
            const has = function (type: WithUUID<new () => Service>, cType: WithUUID<new () => Characteristic>) {
                const s = acc.services.find((s: ServiceDescription) => s.create && s.create.UUID === type.UUID)
                if (s === undefined) {
                    return undefined
                }
                return s.characteristics.find((c) => c.create && c.create.UUID == cType.UUID)
            }

            //find fitting services
            acc.fakeGato = {
                room: {
                    temp: self._findTempService(has),
                    humidity: self._findHumidityService(has),
                    ppm: self._findPPMService(has),
                },
                motion: {
                    status: self._findMotionService(has),
                },
                history: [],
            }

            //Add history Providers
            acc.fakeGato.history = []
            if (acc.fakeGato.room.temp && acc.fakeGato.room.humidity && acc.fakeGato.room.ppm) {
                acc.fakeGato.history.push({ type: 'room', data: acc.fakeGato.room, logService: undefined })
            } else if (acc.fakeGato.room.temp && acc.fakeGato.room.humidity) {
                acc.fakeGato.history.push({ type: 'weather', data: { temp: acc.fakeGato.room.temp, humidity: acc.fakeGato.room.humidity }, logService: undefined })
            } else if (acc.fakeGato.motion.status) {
                acc.fakeGato.history.push({ type: 'motion', data: acc.fakeGato.motion, logService: undefined })
            }
        })
    }

    addFakeGatoService(fakeGato: FakeGatoProvider, accessory: PlatformAccessory) {
        //add the fakeGato service if needed
        if (fakeGato && this.fakeGato.interval > 0) {
            ;(accessory as any).log = this.parent.log
            fakeGato.history.forEach((h) => {
                const airQualityService = accessory.getService(this.parent.api.hap.Service.AirQualitySensor)

                if (airQualityService && h.type === 'room' && h.data.ppm) {
                    let airQualityC: Characteristic = airQualityService.getCharacteristic(this.parent.supported.EveAirQuality)

                    const valueGetter = () => {
                        if (h.data.ppm) {
                            if (h.data.ppm.connect?.UUID === this.parent.api.hap.Characteristic.PM2_5Density.UUID || h.data.ppm.connect?.UUID === this.parent.api.hap.Characteristic.PM10Density.UUID) {
                                //sems to be ug/m3 not ppm => convert like https://github.com/simont77/fakegato-history/issues/107
                                return Math.max(500, h.data.ppm.value / 4.57)
                            } else {
                                return Math.max(500, h.data.ppm.value)
                            }
                        }

                        return 0
                    }
                    if (airQualityC === undefined) {
                        this.parent.log.debug(
                            `Adding Eve PPM Characteristic to '${this.name}', ${this.deviceID}, ${this.serviceConfig.uniquePrefix ? this.serviceConfig.uniquePrefix : ''} = ${valueGetter()}`
                        )
                        airQualityService.setCharacteristic(this.parent.supported.EveAirQuality, valueGetter())
                        airQualityC = airQualityService.getCharacteristic(this.parent.supported.EveAirQuality)
                    } else {
                        this.parent.log.debug(`Updating initial value for Eve PPM Characteristic to ${valueGetter()}`)
                        airQualityC.updateValue(valueGetter())
                    }

                    if (h.data.ppm.connect) {
                        h.data.ppm.connect.chain = airQualityC
                        h.data.ppm.connect.chainValue = valueGetter
                    }
                }

                h.logService = accessory.getService(this.parent.supported.FakeGatoService.UUID)
                if (h.logService === undefined) {
                    this.parent.log.debug(`Adding FakeGatoService '${h.type}' to '${this.name}', ${this.deviceID}, ${this.serviceConfig.uniquePrefix ? this.serviceConfig.uniquePrefix : ''}`)
                    h.logService = new (this.parent.supported.FakeGatoService as any)(h.type, accessory, { size: 4000, disableTimer: true })
                }
            })
        }
    }

    fakegatoEvent() {
        const self = this
        this.parent.log.info('Timer - ', this.name)

        this.supportedAccessories
            .filter((acc: AcceessoryDescription) => acc.fakeGato && acc.fakeGato.history.length > 0)
            .forEach((acc: AcceessoryDescription) => {
                acc.fakeGato.history.forEach((h) => {
                    const data = {
                        time: Math.round(new Date().valueOf() / 1000),
                    }
                    Object.keys(h.data).forEach((k) => {
                        const c = h.data[k]

                        if (c) {
                            if (k === 'ppm') {
                                data[k] = Math.max(500, c.value)
                            } else {
                                data[k] = c.value
                            }

                            //no auto updates, so trigger manual reads
                            //if (c.source.perms && (c.source.perms.indexOf('ev')<0))
                            if (c.connect) {
                                this.parent.log.info('FakeGato Triggered Value read', c.cname)

                                self._updateCharacteristicValue(c.connect, c)
                            }
                        }
                    })

                    this.parent.log.info('Writing FakeGato', h.type, data)
                    h.logService.addEntry(data)
                })
            })
    }
}
