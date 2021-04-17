import { Characteristic, Service, API, WithUUID, Perms, Formats, CharacteristicProps } from 'homebridge'
import { inherits } from 'util'
import fakegato from 'fakegato-history'

export function listKnownServices(api: API, parent: SupportedServices): WithUUID<new () => Service>[] {
    return [
        api.hap.Service.HumiditySensor,
        api.hap.Service.TemperatureSensor,
        api.hap.Service.CarbonDioxideSensor,
        api.hap.Service.CarbonMonoxideSensor,
        api.hap.Service.AirQualitySensor,
        api.hap.Service.ProtocolInformation,
        api.hap.Service.AccessoryInformation,
        api.hap.Service.Switch,
        api.hap.Service.MotionSensor,
        api.hap.Service.BatteryService,
        api.hap.Service.Battery,
        api.hap.Service.Lightbulb,
        api.hap.Service.Outlet,
        api.hap.Service.LightSensor,
        parent.LayoutDetectionService,
        parent.AnimationService,
        parent.FirmwareUpdateService,
        parent.CloudSyncService,
    ]
}
export function listKnownCharacteristics(api: API): WithUUID<new () => Characteristic>[] {
    return [
        api.hap.Characteristic.Identify,
        api.hap.Characteristic.Manufacturer,
        api.hap.Characteristic.Model,
        api.hap.Characteristic.Name,
        api.hap.Characteristic.SerialNumber,
        api.hap.Characteristic.FirmwareRevision,
        api.hap.Characteristic.HardwareRevision,
        api.hap.Characteristic.ProductData,
        api.hap.Characteristic.Version,
        api.hap.Characteristic.IsConfigured,
        api.hap.Characteristic.AirQuality,
        api.hap.Characteristic.PM2_5Density,
        api.hap.Characteristic.PM10Density,
        api.hap.Characteristic.CarbonDioxideDetected,
        api.hap.Characteristic.CarbonDioxideLevel,
        api.hap.Characteristic.CarbonDioxidePeakLevel,
        api.hap.Characteristic.CarbonMonoxideDetected,
        api.hap.Characteristic.CarbonMonoxideLevel,
        api.hap.Characteristic.CarbonMonoxidePeakLevel,
        api.hap.Characteristic.CurrentTemperature,
        api.hap.Characteristic.CurrentRelativeHumidity,
        api.hap.Characteristic.On,
        api.hap.Characteristic.OutletInUse,
        api.hap.Characteristic.MotionDetected,
        api.hap.Characteristic.StatusLowBattery,
        api.hap.Characteristic.BatteryLevel,
        api.hap.Characteristic.Brightness,
        api.hap.Characteristic.Hue,
        api.hap.Characteristic.ColorTemperature,
        api.hap.Characteristic.Saturation,
        api.hap.Characteristic.CurrentAmbientLightLevel,
        api.hap.Characteristic.AirParticulateDensity,
        api.hap.Characteristic.ChargingState,
    ]
}

interface GenericItem {
    id: string
    cls: WithUUID<new () => Service> | WithUUID<new () => Characteristic>
}

export interface ServiceItem {
    id: string
    cls: WithUUID<new () => Service>
}
export interface CharacteristicItem {
    id: string
    cls: WithUUID<new () => Characteristic>
}

function shortType(type: string): string {
    const parts = type.split('-')
    if (parts.length > 0) {
        let p = 0
        while (parts[0][p] === '0' && p < parts[0].length) {
            p++
        }
        return parts[0].substring(p)
    }

    return type
}

function mapShort(list: (WithUUID<new () => Characteristic> | WithUUID<new () => Service>)[]): GenericItem[] {
    const res: any[] = list
        .map((s: WithUUID<new () => Service> | WithUUID<new () => Characteristic>) => {
            const item: GenericItem[] = [
                {
                    id: s.UUID,
                    cls: s,
                },
                {
                    id: shortType(s.UUID),
                    cls: s,
                },
            ]
            return item
        })
        .flat(1)

    return res
}

export function classFromID(list: (ServiceItem | CharacteristicItem)[], id: string) {
    const result = list.find((item) => item.id === id)
    if (result) {
        return result.cls
    }
    return undefined
}

function generateCharacteristic(api: API, name: string, UUID: string, perms: CharacteristicProps) {
    const NewCharacteristic = function (this: any) {
        const self: any = this
        api.hap.Characteristic.call(self, name, UUID, perms)
        self.value = self.getDefaultValue()
    }
    NewCharacteristic.UUID = UUID
    NewCharacteristic.uuid = UUID

    inherits(NewCharacteristic, api.hap.Characteristic)

    return NewCharacteristic as any
}

function generateService(api: API, name: string, UUID: string) {
    const NewService = function (this: any) {
        const self: any = this
        api.hap.Service.call(self, name, UUID)
    }
    NewService.UUID = UUID
    NewService.uuid = UUID

    inherits(NewService, api.hap.Service)

    return NewService as any
}

//as defined here: https://github.com/simont77/fakegato-history/wiki/Services-and-characteristics-for-Elgato-Eve-devices
function _buildEveAirQuality(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Air Quality PM25', 'E863F10B-079E-48FF-8F27-9C2605A29F52', {
        format: Formats.UINT16,
        unit: 'ppm',
        maxValue: 65535,
        minValue: 450,
        minStep: 1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
    })
}

function _buildLayoutDetectionService(api: API): WithUUID<new () => Service> {
    return generateService(api, 'Layout Detection Service', 'A18E7901-CFA1-4D37-A10F-0071CEEEEEBD')
}

function _buildAnimationService(api: API): WithUUID<new () => Service> {
    return generateService(api, 'Animation Service', 'A18E6901-CFA1-4D37-A10F-0071CEEEEEBD')
}

function _buildFirmwareUpdateService(api: API): WithUUID<new () => Service> {
    return generateService(api, 'Firmware Update Service', 'A18E1901-CFA1-4D37-A10F-0071CEEEEEBD')
}

function _buildCloudSyncService(api: API): WithUUID<new () => Service> {
    return generateService(api, 'Cloud Sync', 'A18EB901-CFA1-4D37-A10F-0071CEEEEEBD')
}
export class SupportedServices {
    private _KnownServiceMap: ServiceItem[]
    private _KnownCharMap: CharacteristicItem[]
    public readonly EveAirQuality: WithUUID<new () => Characteristic>
    public readonly FakeGatoService: WithUUID<new () => Service>
    public readonly LayoutDetectionService: WithUUID<new () => Service>
    public readonly AnimationService: WithUUID<new () => Service>
    public readonly FirmwareUpdateService: WithUUID<new () => Service>
    public readonly CloudSyncService: WithUUID<new () => Service>

    constructor(api: API) {
        this.EveAirQuality = _buildEveAirQuality(api)
        this.FakeGatoService = fakegato(api)

        this.LayoutDetectionService = _buildLayoutDetectionService(api)
        this.AnimationService = _buildAnimationService(api)
        this.FirmwareUpdateService = _buildFirmwareUpdateService(api)
        this.CloudSyncService = _buildCloudSyncService(api)

        this._KnownServiceMap = mapShort(listKnownServices(api, this)) as ServiceItem[]
        this._KnownCharMap = mapShort(listKnownCharacteristics(api)) as CharacteristicItem[]

        // this.EveAirQuality = class EveAirQuality extends api.hap.Characteristic {
        //     static readonly UUID: string = 'E863F10B-079E-48FF-8F27-9C2605A29F52'

        //     constructor() {
        //         super('Air Quality PM25', EveAirQuality.UUID, {
        //             format: Formats.UINT16,
        //             perms: [Perms.NOTIFY, Perms.PAIRED_READ],
        //             maxValue: 65535,
        //             minValue: 500,
        //             minStep: 1,
        //         })
        //         this.value = this.getDefaultValue()
        //     }
        // }
    }

    get KnownServiceMap(): ServiceItem[] {
        return this._KnownServiceMap
    }
    get KnownCharMap(): CharacteristicItem[] {
        return this._KnownCharMap
    }

    classForService(type: string) {
        return classFromID(this._KnownServiceMap, type) as WithUUID<new () => Service> | undefined
    }

    classForChar(type: string) {
        return classFromID(this._KnownCharMap, type) as WithUUID<new () => Characteristic> | undefined
    }
}
