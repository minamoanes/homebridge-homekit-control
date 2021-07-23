import { Characteristic, Service, API, WithUUID, Perms, Formats, CharacteristicProps } from 'homebridge'
import { inherits } from 'util'
import fakegato from 'fakegato-history'
import { HttpClientCharacteristic, HttpClientService } from './Interfaces'

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
        api.hap.Service.IrrigationSystem,
        api.hap.Service.Valve,
        parent.LayoutDetectionService,
        parent.AnimationService,
        parent.FirmwareUpdateService,
        parent.CloudSyncService,
    ]
}
export function listKnownCharacteristics(api: API, parent: SupportedServices): WithUUID<new () => Characteristic>[] {
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
        api.hap.Characteristic.Active,
        api.hap.Characteristic.ProgramMode,
        api.hap.Characteristic.InUse,
        api.hap.Characteristic.RemainingDuration,
        api.hap.Characteristic.StatusFault,
        api.hap.Characteristic.ValveType,
        api.hap.Characteristic.SetDuration,
        api.hap.Characteristic.ServiceLabelIndex,
        parent.CloudHomeSync,
        parent.CloudHomeSyncDescription,
        parent.CloudProvisioningHashString,
        parent.NanoleafColorTemperature,
        parent.AnimationSelect,
        parent.AnimationWrite,
        parent.AnimationRead,
        parent.AnimationList,
        parent.AnimationPlayList,
        parent.RythmActive,
        parent.RythmConnected,
        parent.RythmMode,
        parent.RythmAuxAvailable,
        parent.NanoleafCustomEventNotifications,
        parent.LayoutDetectionButton,
        parent.LayoutData,
        parent.GlobalOrientation,
        parent.ProductWarnings,
        parent.NewFirmwareVersion,
        parent.FirmwareAvailability,
        parent.InstallFirmwareUpdate,
        parent.SyncState,
        parent.RestoreFromCloud,
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

function generateCharacteristic(api: API, name: string, UUID: string, perms: CharacteristicProps): WithUUID<new () => Characteristic> {
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

function generateService(api: API, name: string, UUID: string, optionals?: WithUUID<new () => Characteristic>[]): WithUUID<new () => Service> {
    if (optionals === undefined) {
        optionals = []
    }
    const NewService = function (this: any, displayName: string | undefined, UUID: string, subtype?: string) {
        const self: any = this
        api.hap.Service.call(self, name, UUID, subtype)
        optionals?.forEach((o) => this.addOptionalCharacteristic(o))
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

function _buildCloudProvisioningHashString(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Cloud Provisioning Hash String', 'A18E8903-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN],
    })
}

function _buildCloudHomeSync(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Cloud Home Sync Description', 'A18E8902-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN],
    })
}

function _buildCloudHomeSyncDescription(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Cloud Home Sync Description', 'A18E8902-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN],
    })
}

function _buildNanoleafColorTemperature(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Color Temperature', 'A18E5901-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.INT,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.PAIRED_WRITE, Perms.NOTIFY],
        minValue: 1200,
        maxValue: 6500,
        minStep: 1,
    })
}

function _buildAnimationSelect(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Animation Select', 'A18E6902-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.PAIRED_WRITE, Perms.NOTIFY],
    })
}

function _buildAnimationWrite(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Animation Write', 'A18E6903-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_WRITE, Perms.HIDDEN],
    })
}

function _buildAnimationRead(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Animation Read', 'A18E6904-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN],
    })
}

function _buildAnimationList(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Animation List', 'A18E6905-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}

function _buildAnimationPlayList(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Animation Playlist', 'A18E690B-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}

function _buildRythmActive(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Rhythm Active', 'A18E6907-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}

function _buildRythmConnected(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Rhythm Connected', 'A18E6906-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}

function _buildRythmMode(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Rhythm Mode', 'A18E6908-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.INT,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY, Perms.PAIRED_WRITE],
        maxValue: 1,
        minValue: 0,
        minStep: 1,
        unit: 'int',
    })
}

function _buildRythmAuxAvailable(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Rhythm Aux Available', 'A18E6909-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}

function _buildNanoleafCustomEventNotifications(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Custom Event Notifications', 'A18E690A-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}

function _buildLayoutDetectionButton(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Layout Detection Button', 'A18E7902-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.PAIRED_WRITE],
    })
}
function _buildLayoutData(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Layout Data', 'A18E7903-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY],
    })
}
function _buildGlobalOrientation(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Global Orientation', 'A18E7904-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.INT,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.NOTIFY, Perms.PAIRED_WRITE],
        maxValue: 360,
        minValue: 0,
        minStep: 1,
    })
}
function _buildProductWarning(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Product Warnings', 'A18E7905-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.DATA,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY, Perms.HIDDEN],
    })
}

function _buildNewFirmwareVersion(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'New Firmware Version', 'A18E1905-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
    })
}
function _buildFirmwareAvailability(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Firmware Availability', 'A18E1904-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY, Perms.HIDDEN],
    })
}
function _buildInstallFirmwareUpdate(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Install Firmware Update', 'A18E1902-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_READ, Perms.HIDDEN, Perms.PAIRED_WRITE],
    })
}

function _buildSyncState(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Sync State', 'A18EB902-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.INT,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.PAIRED_WRITE],
        maxValue: 2,
        minValue: 0,
        minStep: 1,
    })
}
function _buildRestoreFromCloud(api: API): WithUUID<new () => Characteristic> {
    return generateCharacteristic(api, 'Restore From Cloud', 'A18EB903-CFA1-4D37-A10F-0071CEEEEEBD', {
        format: Formats.BOOL,
        perms: [Perms.PAIRED_WRITE],
    })
}

function _buildLayoutDetectionService(api: API, parent: SupportedServices): WithUUID<new () => Service> {
    return generateService(api, 'Layout Detection Service', 'A18E7901-CFA1-4D37-A10F-0071CEEEEEBD', [parent.LayoutDetectionButton, parent.LayoutData, parent.GlobalOrientation, parent.ProductWarnings])
}

function _buildAnimationService(api: API, parent: SupportedServices): WithUUID<new () => Service> {
    return generateService(api, 'Animation Service', 'A18E6901-CFA1-4D37-A10F-0071CEEEEEBD', [
        parent.AnimationSelect,
        parent.AnimationWrite,
        parent.AnimationRead,
        parent.AnimationList,
        parent.AnimationPlayList,
        parent.RythmActive,
        parent.RythmConnected,
        parent.RythmMode,
        parent.RythmAuxAvailable,
        parent.NanoleafCustomEventNotifications,
    ])
}

function _buildFirmwareUpdateService(api: API, parent: SupportedServices): WithUUID<new () => Service> {
    return generateService(api, 'Firmware Update Service', 'A18E1901-CFA1-4D37-A10F-0071CEEEEEBD', [parent.NewFirmwareVersion, parent.FirmwareAvailability, parent.InstallFirmwareUpdate])
}

function _buildCloudSyncService(api: API, parent: SupportedServices): WithUUID<new () => Service> {
    return generateService(api, 'Cloud Sync', 'A18EB901-CFA1-4D37-A10F-0071CEEEEEBD', [parent.SyncState, parent.RestoreFromCloud])
}
export class SupportedServices {
    private api: API
    private _KnownServiceMap: ServiceItem[]
    private _KnownCharMap: CharacteristicItem[]
    public readonly EveAirQuality: WithUUID<new () => Characteristic>
    public readonly FakeGatoService: WithUUID<new () => Service>

    public readonly NanoleafColorTemperature: WithUUID<new () => Characteristic>
    public readonly NanoleafCustomEventNotifications: WithUUID<new () => Characteristic>

    /* Nanoleaf Cloud Service */
    public readonly CloudSyncService: WithUUID<new () => Service>
    public readonly CloudProvisioningHashString: WithUUID<new () => Characteristic>
    public readonly CloudHomeSync: WithUUID<new () => Characteristic>
    public readonly CloudHomeSyncDescription: WithUUID<new () => Characteristic>
    public readonly SyncState: WithUUID<new () => Characteristic>
    public readonly RestoreFromCloud: WithUUID<new () => Characteristic>

    /* Nanoleaf Animation Service */
    public readonly AnimationService: WithUUID<new () => Service>
    public readonly AnimationSelect: WithUUID<new () => Characteristic>
    public readonly AnimationRead: WithUUID<new () => Characteristic>
    public readonly AnimationWrite: WithUUID<new () => Characteristic>
    public readonly AnimationList: WithUUID<new () => Characteristic>
    public readonly AnimationPlayList: WithUUID<new () => Characteristic>
    public readonly RythmActive: WithUUID<new () => Characteristic>
    public readonly RythmConnected: WithUUID<new () => Characteristic>
    public readonly RythmMode: WithUUID<new () => Characteristic>
    public readonly RythmAuxAvailable: WithUUID<new () => Characteristic>

    /* Nanoleaf Layout Service */
    public readonly LayoutDetectionService: WithUUID<new () => Service>
    public readonly LayoutDetectionButton: WithUUID<new () => Characteristic>
    public readonly LayoutData: WithUUID<new () => Characteristic>
    public readonly GlobalOrientation: WithUUID<new () => Characteristic>
    public readonly ProductWarnings: WithUUID<new () => Characteristic>

    /* Nanoleaf Firmware Service */
    public readonly FirmwareUpdateService: WithUUID<new () => Service>
    public readonly NewFirmwareVersion: WithUUID<new () => Characteristic>
    public readonly FirmwareAvailability: WithUUID<new () => Characteristic>
    public readonly InstallFirmwareUpdate: WithUUID<new () => Characteristic>

    constructor(api: API) {
        this.api = api
        this.EveAirQuality = _buildEveAirQuality(api)
        this.FakeGatoService = fakegato(api)

        this.CloudProvisioningHashString = _buildCloudProvisioningHashString(api)
        this.CloudHomeSyncDescription = _buildCloudHomeSyncDescription(api)
        this.CloudHomeSync = _buildCloudHomeSync(api)

        this.NanoleafColorTemperature = _buildNanoleafColorTemperature(api)
        this.AnimationSelect = _buildAnimationSelect(api)
        this.AnimationRead = _buildAnimationRead(api)
        this.AnimationWrite = _buildAnimationWrite(api)
        this.AnimationList = _buildAnimationList(api)
        this.AnimationPlayList = _buildAnimationPlayList(api)
        this.RythmActive = _buildRythmActive(api)
        this.RythmConnected = _buildRythmConnected(api)
        this.RythmMode = _buildRythmMode(api)
        this.RythmAuxAvailable = _buildRythmAuxAvailable(api)
        this.NanoleafCustomEventNotifications = _buildNanoleafCustomEventNotifications(api)

        this.LayoutDetectionButton = _buildLayoutDetectionButton(api)
        this.LayoutData = _buildLayoutData(api)
        this.GlobalOrientation = _buildGlobalOrientation(api)
        this.ProductWarnings = _buildProductWarning(api)

        this.NewFirmwareVersion = _buildNewFirmwareVersion(api)
        this.FirmwareAvailability = _buildFirmwareAvailability(api)
        this.InstallFirmwareUpdate = _buildInstallFirmwareUpdate(api)

        this.SyncState = _buildSyncState(api)
        this.RestoreFromCloud = _buildRestoreFromCloud(api)

        this.LayoutDetectionService = _buildLayoutDetectionService(api, this)
        this.AnimationService = _buildAnimationService(api, this)
        this.FirmwareUpdateService = _buildFirmwareUpdateService(api, this)
        this.CloudSyncService = _buildCloudSyncService(api, this)

        this._KnownServiceMap = mapShort(listKnownServices(api, this)) as ServiceItem[]
        this._KnownCharMap = mapShort(listKnownCharacteristics(api, this)) as CharacteristicItem[]

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

    isID(needle: string, haystack: string): boolean {
        needle = needle.toLocaleUpperCase().trim()
        haystack = haystack.toLocaleUpperCase().trim()
        if (needle === haystack) {
            return true
        }
        while (needle.length < 8) {
            needle = '0' + needle
        }
        haystack = haystack.substring(0, 8)

        return needle === haystack
    }

    toPerm(inp: string[]): Perms[] {
        return inp.map((p: string) => {
            if (p === 'pw') {
                return Perms.PAIRED_WRITE
            }
            if (p === 'wr') {
                return Perms.WRITE_RESPONSE
            }
            if (p === 'pr') {
                return Perms.PAIRED_READ
            }
            if (p === 'ev') {
                return Perms.EVENTS
            }
            if (p === 'aa') {
                return Perms.ADDITIONAL_AUTHORIZATION
            }
            if (p === 'tw') {
                return Perms.TIMED_WRITE
            }
            if (p === 'hd') {
                return Perms.HIDDEN
            }
            return Perms.HIDDEN
        })
    }

    classForService(type: string, source: HttpClientService | undefined) {
        const cl = classFromID(this._KnownServiceMap, type) as WithUUID<new () => Service> | undefined

        if (source === undefined) {
            return cl
        }
        //auto-create new service
        if (cl == undefined) {
            const allKeys = Object.keys(this.api.hap.Service)
            const matches = allKeys
                .filter((key) => this.api.hap.Service[key].UUID != undefined)
                .map((key) => this.api.hap.Service[key])
                .filter((service) => this.isID(type, service.UUID))
            if (matches.length == 1 || matches.length == 0) {
                let s
                if (matches.length == 1) {
                    s = matches[0]
                } else {
                    const characteristics = source.characteristics.map((cIn) => this.classForChar(cIn.type, cIn))
                    const names = source.characteristics.filter((c) => c.type === '23' || c.type === this.api.hap.Characteristic.Name.UUID)
                    const name = names.length > 0 ? names[0].value : undefined

                    s = generateService(this.api, name == undefined ? '' : name, type, characteristics)
                }
                this._KnownServiceMap.push({
                    id: s.UUID,
                    cls: s,
                })
                this._KnownServiceMap.push({
                    id: shortType(s.UUID),
                    cls: s,
                })

                return s
            }
        }

        return cl
    }

    copyCharacteristic(type: string, source: HttpClientCharacteristic) {
        const name = source.description
        return generateCharacteristic(this.api, name === undefined ? '' : name, type, {
            format: source.format,
            perms: this.toPerm(source.perms),
            unit: source.unit,
            description: source.description,
            minValue: source.minValue,
            maxValue: source.maxValue,
            minStep: source.minStep,
            maxLen: source.maxLen,
            maxDataLen: source.maxDataLen,
            validValues: source.validValues,
            validValueRanges: source.validValueRanges,
            adminOnlyAccess: source.adminOnlyAccess,
        })
    }

    classForChar(type: string, source: HttpClientCharacteristic | undefined) {
        const cl = classFromID(this._KnownCharMap, type) as WithUUID<new () => Characteristic> | undefined
        if (source === undefined) {
            return cl
        }
        //auto-create new characteristic
        if (cl == undefined) {
            const allKeys = Object.keys(this.api.hap.Characteristic)
            const matches = allKeys
                .filter((key) => this.api.hap.Characteristic[key].UUID != undefined)
                .map((key) => this.api.hap.Characteristic[key])
                .filter((char) => this.isID(type, char.UUID))
            if (matches.length == 1 || matches.length == 0) {
                const c = matches.length == 1 ? matches[0] : this.copyCharacteristic(type, source)
                this._KnownCharMap.push({
                    id: c.UUID,
                    cls: c,
                })
                this._KnownCharMap.push({
                    id: shortType(c.UUID),
                    cls: c,
                })

                return c
            }
        }

        return cl
    }
}
