import { API, PlatformAccessory, PlatformConfig, IndependentPlatformPlugin, Logging, APIEvent } from 'homebridge'
import { HKClient } from './HKClient'
import { HKPlatformAccessory, HKPlatformConfig, HKServiceConfig, IHKClient, IHKPlatform } from './Interfaces'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import { SupportedServices } from './SupportedDevices'

export class HKPlatform implements IndependentPlatformPlugin, IHKPlatform {
    readonly log: Logging
    readonly api: API
    private readonly config: HKPlatformConfig

    private readonly clients: HKClient[]
    readonly accessories: HKPlatformAccessory[]

    readonly supported: SupportedServices

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.config = config as HKPlatformConfig
        this.api = api
        this.log = log
        this.supported = new SupportedServices(api)

        this.accessories = []
        const self = this

        this.clients = this.config.services === undefined ? [] : this.config.services.map((serviceConfig: HKServiceConfig) => new HKClient(serviceConfig, self))

        this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            if (this.clients.length === 0) {
                this.clientFinishedLaunching(undefined)
            }
        })
    }

    /**
     * REQUIRED - Homebridge will call the "configureAccessory" method once for every cached
     * accessory restored
     */
    configureAccessory(inAccessory: PlatformAccessory): void {
        this.log.debug(`Loaded Accesory ${inAccessory.displayName} (${inAccessory.UUID})`)
        const accessory: HKPlatformAccessory = inAccessory as HKPlatformAccessory
        accessory._wasUsed = false
        this.accessories.push(accessory)
    }

    clientFinishedLaunching(cl: IHKClient | undefined) {
        const allReady = this.clients.map((c) => c.didFinishStartup).filter((ok) => !ok).length === 0
        if (cl !== undefined) {
            this.log.info(`${cl.name} finished Startup. ${allReady ? 'All Clients ready now' : ''}`)
        } else if (allReady) {
            this.log.info('All Clients ready now')
        }

        if (allReady) {
            this.log.info('Loaded Accesories')
            this.log.info(this.accessories.map((a) => ` - [${a._wasUsed ? 'X' : ' '}] ${a.displayName} (${a.UUID})`).join('\n'))
            const unused = this.accessories.filter((a) => a._wasUsed === false)
            this.log.warn(`Found ${unused.length} unused accessories`)

            if (process.argv.some((v) => v === '-Q')) {
                this.log.warn('  --> Deleting all unused accessories')
                unused.forEach((a) => this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [a]))
            }
        }
    }
}
