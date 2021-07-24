import { HttpClient } from 'hap-controller'
import { Logging } from 'homebridge'
import { GetCharacteristicsOptions } from 'hap-controller/lib/transport/ip/http-client'
import HttpConnection from 'hap-controller/lib/transport/ip/http-connection'
import { CharacteristicDescription, PairingData } from './Interfaces'

const TIMEOUT = 5000
const MAX_RETRY = 10

interface QueueItem {
    uuid: string
    name: string
    fkt: () => Promise<any>
    timer: NodeJS.Timer | undefined
    resolve: (value: any) => void
    reject: (reason: any) => void
    finished: boolean
    retries: number
}

interface EventItems {
    c: CharacteristicDescription
    listener: (...args: any[]) => void
}
export class Sequencer {
    private _queue: QueueItem[] = []
    private timer: NodeJS.Timer | undefined = undefined
    private readonly log: Logging
    constructor(log: Logging) {
        this.log = log
    }

    get length(): number {
        return this._queue.length
    }

    get busy(): boolean {
        return this.timer !== undefined
    }

    push(call: () => Promise<any>, name: string, uuid: string): Promise<any> {
        const self = this
        return new Promise((resolve, reject) => {
            this._queue.push({
                uuid: uuid,
                name: name,
                fkt: call,
                timer: undefined,
                resolve: resolve,
                reject: reject,
                finished: false,
                retries: MAX_RETRY,
            })
            self.next()
        })
    }

    private next() {
        const self = this
        this._queue = this._queue.filter((i) => i.finished === false)

        if (self.timer === undefined && this._queue.length > 0) {
            const qi = this._queue.shift()
            self.timer = setTimeout(() => {
                self.timer = setTimeout(() => {
                    self.timer = undefined
                    qi!.retries--

                    if (qi!.retries <= 0) {
                        this.log.debug(`Timeout for Task ${qi!.name}/${qi!.uuid} => GIVING UP`)
                        qi!.reject(`Timeout for Task ${qi!.name}/${qi!.uuid}`)
                    } else {
                        this.log.debug(`Timeout for Task ${qi!.name}/${qi!.uuid} => RETRY`)
                        this._queue.push(qi!)
                    }
                    self.next()
                }, 100)
            }, TIMEOUT)

            qi!
                .fkt()
                .then((value) => {
                    if (self.timer) {
                        clearTimeout(self.timer)
                    }
                    self.timer = setTimeout(() => {
                        self.timer = undefined
                        self._queue
                            .filter((i) => i.name === qi!.name && i.uuid == qi!.uuid && i.finished === false)
                            .forEach((i) => {
                                i.resolve(value)
                                i.finished = true
                            })
                        qi!.resolve(value)

                        self.next()
                    }, 100)
                })
                .catch((e) => {
                    if (self.timer) {
                        clearTimeout(self.timer)
                    }
                    self.timer = setTimeout(() => {
                        self.timer = undefined
                        qi!.reject(e)
                        self.next()
                    }, 100)
                })
        }
    }
}

export class HttpWrapper {
    public readonly client: HttpClient
    private readonly list: Sequencer
    private readonly log: Logging
    private unsubscribeFrom: string[]

    constructor(log: Logging, deviceId: string, address: string, port: number, pairingData?: PairingData) {
        this.log = log
        this.list = new Sequencer(log)
        this.client = new HttpClient(deviceId, address, port, pairingData)
        this.unsubscribeFrom = []
        this.client.on('event', this.onEvent.bind(this))
    }

    private uct: number = 0
    public identify() {
        const self = this
        return self.list.push(
            () => {
                return self.client.identify()
            },
            'identify',
            '-'
        )
    }
    public getAccessories(): Promise<Record<string, unknown>> {
        const self = this
        return self.list.push(
            () => {
                return self.client.getAccessories()
            },
            'getAccessories',
            '-'
        )
    }

    public getCharacteristics(characteristics: string[], options?: GetCharacteristicsOptions): Promise<Record<string, unknown>> {
        const self = this
        return self.list.push(
            () => {
                if (characteristics.length === 0) {
                    return new Promise((resolve) => {
                        resolve({})
                    })
                }
                return self.client.getCharacteristics(characteristics, options)
            },
            'getCharacteristics',
            characteristics.join(', ')
        )
    }

    public setCharacteristics(characteristics: Record<string, unknown>): Promise<Record<string, unknown>> {
        const self = this
        return self.list.push(
            () => {
                return self.client.setCharacteristics(characteristics)
            },
            'setCharacteristics',
            Object.keys(characteristics)
                .map((k) => `${k}=${characteristics[k]}`)
                .join(', ')
        )
    }

    public subscribeCharacteristics(characteristics: string[]): Promise<HttpConnection> {
        const self = this
        this.unsubscribeFrom = this.unsubscribeFrom.concat(characteristics).filter((c, i, a) => a.indexOf(c) === i)
        return self.list.push(
            () => {
                this.log.debug('Running Subscribe task', characteristics.join(', '))
                return self.client.subscribeCharacteristics(characteristics)
            },
            'subscribeCharacteristics',
            characteristics.join(', ')
        )
    }

    private onEvent(event) {
        const self = this
        this.log.debug('Received Event', event)
        event.characteristics.forEach((cc) => {
            const cname = `${cc.aid}.${cc.iid}`
            self.listeners
                .filter((l) => l.c.cname === cname)
                .forEach((l) => {
                    self.log.debug(`Notifiying listener for ${l.c.connect?.displayName} (${cname})`)
                    l.listener(cc)
                })
        })
    }

    public unsubscribeAll() {
        return this.client.subscribeCharacteristics(this.unsubscribeFrom)
    }

    private readonly listeners: EventItems[] = []
    public on(c: CharacteristicDescription, listener: (...args: any[]) => void): this {
        this.listeners.push({
            c: c,
            listener: listener,
        })
        return this
    }
}
