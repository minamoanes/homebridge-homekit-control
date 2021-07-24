import { PlatformAccessory, Service, Characteristic, CharacteristicProps, WithUUID, APIEvent, Formats } from 'homebridge'
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
import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import { Accessories } from 'hap-controller/lib/transport/ble/gatt-client'
import { HttpWrapper } from './HttpWrapper'

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
        props.maxDataLen = source.maxDataLen + 4
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
    private readonly client: HttpWrapper
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

        this.client = new HttpWrapper(this.parent.log, this.serviceConfig.id, this.serviceConfig.address, this.serviceConfig.port, this.serviceConfig.pairingData)
        this.client
            .getAccessories()
            .then((inData: any) => {
                this._preloadValues(inData as Accessories)
                    .then(() => {
                        //looks like this Gatt-Result is the actual return type for httpClient as well
                        self._loadDevices(inData as Accessories)
                        self.accesoriesWereLoaded = true

                        if (this.serviceConfig.logFoundServices) {
                            this.logSourceServices()
                        }

                        if (this.didFinishWasDefered) {
                            this.didFinishWasDefered = false
                            this.didFinishLaunching()
                        }
                    })
                    .catch((e) => {
                        self.parent.log.error('Error', e)
                    })
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

        if (serviceConfig.enableHistory) {
            if (serviceConfig.historyInterval) {
                this.fakeGato.interval = Math.max(30, Math.min(600, serviceConfig.historyInterval))
            } else {
                this.fakeGato.interval = 600
            }
        }

        if (serviceConfig.proxyAll === undefined) {
            serviceConfig.proxyAll = false
        }
    }

    shutdown() {
        this.parent.log.info(`Shuttding down ${this.name}`)
        try {
            this.con().unsubscribeAll()
        } catch (e) {
            this.parent.log.debug('Error on shutdown:', e)
        }
    }

    async _preloadValues(data: Accessories) {
        const list = data.accessories
            .map((a) => {
                return a.services.map((s) => {
                    const r = s.characteristics
                        .filter((c: HttpClientCharacteristic) => c.value === null)
                        .map((c: HttpClientCharacteristic) => {
                            const cany = c as any
                            cany.cname = `${a.aid}.${c.iid}`
                            cany.hadResonse = false
                            return c
                        })
                    return r
                })
            })
            .flat(2)
        const chars = list.map((c: any) => c.cname)
        if (chars.length > 0) {
            const inData: any = await this.con().getCharacteristics(chars, {
                meta: false,
                perms: false,
                type: false,
                ev: false,
            })

            //console.log(inData)
            const newValues = inData.characteristics.filter((d) => d.value !== undefined && d.value != null)
            this.parent.log.debug('Preloaded Values')
            this.parent.log.debug(newValues)

            data.accessories.forEach((a) =>
                a.services.forEach((s) =>
                    s.characteristics.forEach((c: HttpClientCharacteristic) => {
                        const val = newValues.find((v) => v.aid == a.aid && c.iid == v.iid)
                        if (val !== undefined) {
                            c.value = val.value
                        }
                    })
                )
            )
        }
    }

    _loadDevices(data: Accessories) {
        this.supportedAccessories = data.accessories.map((acc: HttpClientAccesory) => {
            const aRes: AcceessoryDescription = {
                fakeGato: {
                    room: {},
                    motion: {},
                    history: [],
                },
                services: acc.services.map((s: HttpClientService) => {
                    //console.log('Service:', s)
                    const name = s.characteristics.filter((c) => c.type === '23' || c.type === '00000023' || c.type === this.parent.api.hap.Characteristic.Name.UUID)
                    let displayName: string | undefined = undefined
                    if (name.length > 0) {
                        displayName = name[0].value
                    }
                    if (displayName === undefined || displayName === null) {
                        displayName = `c-${s.iid}`
                    }

                    const cl = this.parent.supported.classForService(s.type, this.serviceConfig.proxyAll ? s : undefined)
                    const sRes: ServiceDescription = {
                        create: cl,
                        uuid: cl !== undefined ? cl.UUID : s.type,
                        displayName: displayName,
                        uname: `${this.uuid}.${acc.aid}.${s.iid}`,
                        iid: s.iid,
                        characteristics: s.characteristics
                            .map((c: HttpClientCharacteristic) => {
                                const ccl = this.parent.supported.classForChar(c.type, this.serviceConfig.proxyAll ? c : undefined)
                                const cRes: CharacteristicDescription = {
                                    create: ccl,
                                    uuid: ccl !== undefined ? ccl.UUID : c.type,
                                    iid: c.iid === undefined ? 0 : c.iid,
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
                                    this.parent.log.warn(`${this.name}: Missing Chracteristic in ${s.type} with type ${c.source.type}`)
                                    if (this.serviceConfig.logFoundServices) {
                                        this.parent.log.warn(JSON.stringify(c.source, null, 4))
                                    }
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
    }

    logSourceServices() {
        this.parent.log.info(
            this.supportedAccessories
                .map((a: AcceessoryDescription, i) => {
                    const services = a.services
                        .map((s: ServiceDescription) => {
                            let name = '?'
                            if (s.create) {
                                const ss = new s.create('dn', 'st')
                                name = ss.displayName
                            }
                            const chars = s.characteristics
                                .map((c: CharacteristicDescription) => {
                                    let name = '?'
                                    let props = ''
                                    if (c.create) {
                                        const cc = new c.create()
                                        name = cc.displayName
                                        props = JSON.stringify(cc.props)
                                    }
                                    return `${name}, ${c.create?.UUID}: ${c.value}\n        (${props})}`
                                })
                                .join('\n    - ')
                            return `Service ${name}, ${s.source.type}, ${s.create?.UUID}\n    - ${chars}`
                        })
                        .join('\n - ')
                    return `Accessory ${i + 1}:\n - ${services}`
                })
                .join('\n')
        )
    }

    con(): HttpWrapper {
        return this.client
    }

    private _updateCharacteristicValue(char: ExtendedCharacteristic, c: CharacteristicDescription) {
        if (!c.allowValueUpdates) {
            return
        }

        const self = this
        self.parent.log.debug(`${self.name} - send get ${char.displayName} (${c.cname})`)

        this.con()
            .getCharacteristics([c.cname], {
                meta: false,
                perms: false,
                type: false,
                ev: false,
            })
            .then((inData: any) => {
                const data = inData as HttpClientService
                const old = c.value
                c.value = this.checkValue(data.characteristics[0].value, char.props)
                self.parent.log.debug(`${self.name} - received ${char.displayName}=${c.value} (was ${old}, ${c.cname})`)

                if (c.value != null) {
                    char.updateValue(c.value)
                }

                if (char.chain && char.chainValue) {
                    this.parent.log.debug(` ==> Chain received value from ${char.displayName} to ${char.chain.displayName} (Value=${char.chainValue()})`)
                    char.chain.updateValue(char.chainValue())
                }
            })
            .catch((e) => {
                self.parent.log.error(`${self.name} - get error ${char.displayName}=${c.value} (${c.cname}, ${e})`)
                console.error(e)
            })
    }

    private checkValue(value: any, props: CharacteristicProps | HttpClientCharacteristic): any {
        let didChange = true
        if (value === null || value === undefined) {
            value = 0
            didChange = false
        }

        if (props.minValue !== undefined) {
            didChange = true
            value = Math.max(props.minValue, value)
        }
        if (props.maxValue !== undefined) {
            didChange = true
            value = Math.min(props.maxValue, value)
        }

        if (props.format === Formats.DATA && props.maxDataLen) {
            didChange = true
        }

        if (props.format === Formats.STRING) {
            didChange = true
            value = '' + value
        }

        if (!didChange) {
            return null
        }

        return value
    }

    private _setCharacteristicValue(char: ExtendedCharacteristic, value: any, c: CharacteristicDescription) {
        value = this.checkValue(value, char.props)
        if (value == null) {
            return
        }

        const data = {}
        const self = this
        data[c.cname] = value
        self.parent.log.debug(`${self.name} - send set ${char.displayName}=${c.value} (${c.cname})`)

        this.con()
            .setCharacteristics(data)
            .then(() => {
                c.value = value
                self.parent.log.info(`${self.name} - wrote ${char.displayName}=${c.value} (${c.cname})`)
            })
            .catch((e) => {
                self.parent.log.error(`${self.name} - set failed ${char.displayName}=${c.value} (${c.cname}, ${e})`)
            })
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
                    const value = this.checkValue(c.value, c.source)
                    if (value != null) {
                        service.setCharacteristic(c.create, value)
                    }
                }

                const char = service.characteristics.find((cc) => cc.UUID === c.uuid) as ExtendedCharacteristic
                //const char = service.getCharacteristic(c.create as any) as ExtendedCharacteristic
                if (char === undefined) {
                    this.parent.log.error('Unknown Characteristic: ', c.cname, service.UUID, service.characteristics.map((c) => `${c.iid}-${c.displayName}`).join(','))
                    return
                }
                c.connect = char
                copyProps(c.source, char)

                if (c.source.perms && c.source.perms.indexOf('pr') >= 0) {
                    if (char.hasOnGet) {
                        console.log('ALREADY HAS a GET WATCH', c.cname, c.uuid)
                    } else {
                        console.log('ADDING GET WATCH', c.cname, c.uuid)
                    }

                    char.hasOnGet = true
                    char.on('get', (callback) => {
                        c.value = this.checkValue(c.value, char.props)
                        //console.log('GET GET GET', c.cname, callback)

                        callback(null, c.value)

                        self._updateCharacteristicValue(char, c)
                    })
                }

                if ((c.source.perms && c.source.perms.indexOf('pw') >= 0) || c.source.perms.indexOf('tw') >= 0) {
                    char.on('set', (value, callback) => {
                        self._setCharacteristicValue(char, value, c)
                        //console.log('SET SET SET')
                        if (c.source.perms && c.source.perms.indexOf('wr') >= 0) {
                            callback(null, value)
                        } else {
                            callback(null, null)
                        }
                    })
                }

                if (c.allowValueUpdates && c.source.perms && c.source.perms.indexOf('ev') >= 0 && (c.source.ev === undefined || c.source.ev)) {
                    const cl = this.con()
                    cl.on(c, (data) => {
                        if (data.value !== undefined && data.value !== null) {
                            this.parent.log.debug(`${this.name} - Got Event for ${char.displayName} (${c.cname}). Changed value ${c.value} => ${data.value}`)

                            c.value = this.checkValue(data.value, char.props)
                            if (c.value != null) {
                                char.updateValue(data.value)
                            }

                            if (char.chain && char.chainValue) {
                                this.parent.log.debug(` ==> Chain event from ${char.displayName} to ${char.chain.displayName} (Value=${char.chainValue()})`)
                                char.chain.updateValue(char.chainValue())
                            }
                        }
                    })

                    this.parent.log.debug(`${char.displayName} (${c.cname}) Has Events, trying to subscribe`)
                    cl.subscribeCharacteristics([c.cname])
                        .then((conn) => {
                            this.parent.log.debug(`${this.name}, ${char.displayName} (${c.cname}) Subscribed to Events`)
                            c.connection = conn
                        })
                        .catch((e) => {
                            this.parent.log.error(`${char.displayName} failed to Subscribe`, e)
                        })
                }
            } else {
                this.parent.log.warn(`Unable to create Characteristic ${c.uname} of type ${c.source.type}`)
            }
        })
    }
    private _serviceCreator(sData: ServiceDescription, accessory: PlatformAccessory, allServices: ServiceDescription[]) {
        if (sData.create) {
            const hasSameService = allServices.filter((s) => s.uuid === sData.uuid).length > 1
            const subtype = sData.displayName !== undefined && sData.displayName !== null ? sData.displayName : `${sData.iid}`
            const serviceGeneral: Service | undefined = accessory.getService(sData.create as any)

            //this method does some strange compating (uuid with displayname), better implement our own search...
            //let service: Service | undefined = accessory.getServiceById(sData.uuid, subtype)
            let service: Service | undefined = hasSameService ? accessory.services.find((s) => s.UUID === sData.uuid && s.subtype === subtype) : serviceGeneral

            //console.log(serviceGeneral !== undefined, service !== undefined)
            //some services are predefined without an iid, so we keep them
            // if (service === undefined && serviceGeneral !== undefined) {
            //     const aService = new sData.create(subtype)
            //     console.log('IID', serviceGeneral.iid, sData.iid)
            //     if (serviceGeneral.iid === null || sData.iid === null) {
            //         service = serviceGeneral
            //     }
            // }
            if (service !== undefined) {
                this.parent.log.debug(`REUSING SERVICE', uuid=${service.UUID}, st=${subtype}, nst=${service.subtype}, niid=${service.iid}, iid=${sData.iid}`)
                accessory.removeService(service)
                service = undefined
            }

            if (service === undefined) {
                let newService = new sData.create(sData.displayName, subtype)
                if (newService.UUID !== sData.uuid) {
                    console.log(`nuuid=${newService.UUID}, uuid=${sData.uuid}`)
                    newService = new sData.create(sData.displayName, sData.uuid)
                }

                this.parent.log.debug(`NEW SERVICE, uuid=${sData.uuid} nuuid=${newService.UUID}, st=${subtype}, nst=${newService.subtype}, niid=${newService.iid}, dn=${newService.displayName}`)
                try {
                    service = accessory.addService(newService)
                } catch (e) {
                    this.parent.log.error(`Unable to add new version of service UUID=${newService.UUID}, subtype=${subtype}`)
                    this.parent.log.error(e)
                }
            } else {
                //this.parent.log.debug(`REUSING SERVICE', uuid=${service.UUID}, st=${subtype}, nst=${service.subtype}, niid=${service.iid}, iid=${sData.iid}`)
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
            accessoryServices.services.map((sData: ServiceDescription) => self._serviceCreator(sData, accessory, accessoryServices.services))
            //console.log(accessoryServices.services)
            this.addAditionalServices(accessoryServices, accessory)

            // register the accessory
            try {
                this.parent.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
            } catch (e) {
                this.parent.log.error(e)
            }
        } else {
            this.parent.log.debug(`Reconfiguring existing Accesory ${configuredAcc.displayName} (${configuredAcc.UUID})`)
            /*const services = */ accessoryServices.services.map((sData: ServiceDescription) => self._serviceCreator(sData, configuredAcc, accessoryServices.services))
            //console.log('-----------------------')
            //console.log(accessoryServices.services)
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
        //console.log('COUNT', this.supportedAccessories.length)
        this.supportedAccessories.forEach((acc: AcceessoryDescription) => {
            //console.log('ACC', idx)
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
            //console.log(idx, acc.fakeGato)

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
            const _accessory: any = accessory as any
            _accessory.log = this.parent.log
            fakeGato.history.forEach((h) => {
                const airQualityService = accessory.getService(this.parent.api.hap.Service.AirQualitySensor)

                if (airQualityService && h.type === 'room' && h.data.ppm) {
                    let airQualityC: Characteristic = airQualityService.getCharacteristic(this.parent.supported.EveAirQuality)

                    const valueGetter = () => {
                        if (h.data.ppm) {
                            if (h.data.ppm.connect?.UUID === this.parent.api.hap.Characteristic.PM2_5Density.UUID || h.data.ppm.connect?.UUID === this.parent.api.hap.Characteristic.PM10Density.UUID) {
                                //sems to be ug/m3 not ppm => convert like https://github.com/simont77/fakegato-history/issues/107
                                return Math.max(450, h.data.ppm.value / 4.57)
                            } else {
                                return Math.max(450, h.data.ppm.value)
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
                                data[k] = Math.max(450, c.value)
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
