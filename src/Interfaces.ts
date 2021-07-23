import HttpConnection from 'hap-controller/lib/transport/ip/http-connection'
import { API, Characteristic, Logging, PlatformAccessory, PlatformConfig, Service, WithUUID } from 'homebridge'
import { SupportedServices } from './SupportedDevices'

export interface PairingData {
    AccessoryPairingID: string
    AccessoryLTPK: string
    iOSDevicePairingID: string
    iOSDeviceLTSK: string
    iOSDeviceLTPK: string
}

export interface HKServiceConfig {
    uniquePrefix?: string
    enableHistory?: boolean
    historyInterval?: number
    logFoundServices?: boolean
    name?: string
    id: string
    address: string
    port: number
    pairingData: PairingData
    proxyAll?: boolean
}
export interface HKPlatformConfig extends PlatformConfig {
    services: HKServiceConfig[]
}
export interface IHKClient {
    readonly didFinishStartup: boolean
    readonly name: string
}

export interface IHKPlatform {
    readonly log: Logging
    readonly api: API
    readonly supported: SupportedServices
    readonly accessories: HKPlatformAccessory[]
    clientFinishedLaunching: (cl: IHKClient | undefined) => void
}

export interface HKPlatformAccessory extends PlatformAccessory {
    _wasUsed: boolean
}

export interface ExtendedCharacteristic extends Characteristic {
    chain?: Characteristic
    chainValue?: () => any
}

export interface CharacteristicDescription {
    create?: WithUUID<new () => Characteristic>
    uname: string
    cname: string
    value?: any
    source: HttpClientCharacteristic
    allowValueUpdates: boolean
    connect?: ExtendedCharacteristic
    connection?: HttpConnection
}

interface HistoryProvider {
    [key: string]: CharacteristicDescription | undefined
}
export interface FakeGatoHistoryProvider {
    type: string
    data: HistoryProvider
    logService: any
}

export interface FakeGatoProvider {
    room: {
        temp?: CharacteristicDescription
        humidity?: CharacteristicDescription
        ppm?: CharacteristicDescription
    }
    motion: {
        status?: CharacteristicDescription
    }
    history: FakeGatoHistoryProvider[]
}

export interface AcceessoryDescription {
    services: ServiceDescription[]
    fakeGato: FakeGatoProvider
}

export interface ServiceDescription {
    create?: WithUUID<new () => Service>
    uname: string
    characteristics: CharacteristicDescription[]
    source: HttpClientService
}

export interface HttpClientAccesory {
    aid: number
    services: HttpClientService[]
}

export interface HttpClientService {
    iid: number
    type: string
    characteristics: HttpClientCharacteristic[]
    primary?: boolean
    hidden?: boolean
}

export interface CharacteristicProps {
    perms: string[]
    format: string
    minValue?: number
    maxValue?: number
    minStep?: number
    unit?: any
    description?: string
    maxLen?: number
    maxDataLen?: number
    validValues?: any
    validValueRanges?: any
    adminOnlyAccess?: any
}

export interface HttpClientCharacteristic extends CharacteristicProps {
    type: string
    ev: boolean

    iid?: number
    value?: any
}

export interface HttpClientAccessories {
    accessories: HttpClientAccesory[]
}
