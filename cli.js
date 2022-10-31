#!/usr/bin/env node

const cliSelect = require('cli-select')
const cliProgress = require('cli-progress')
const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')
const readline = require('readline')

const optionDefinitions = [
    { name: 'discoverTime', alias: 't', type: Number, defaultValue: 30, typeLabel: '{underline number} in s', description: 'Time the device discovery runs in seconds' },
    { name: 'interface', alias: 'i', type: String, typeLabel: '{underline string}', description: 'Name of the network device to listen for HomeKit items. For example: {italic wlan0}' },
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Print this usage guide.',
    },
]

const options = commandLineArgs(optionDefinitions)
if (options.help !== undefined) {
    const sections = [
        {
            header: 'HomeKit Device Discovery',
            content: 'Discovers available HomeKit devices on a network, pairs with them and writes the neccesary pairing-information into a file.',
        },
        {
            header: 'Options',
            optionList: optionDefinitions,
        },
    ]
    const usage = commandLineUsage(sections)
    console.log(usage)
    process.exit(0)
}

(async () => {
    const { IPDiscovery, HttpClient } = require('hap-controller')

    const fs = require('fs')

    const discover = () =>
        new Promise((resolve, reject) => {
            console.clear()
            console.log('Homkit Device Discovery')
            console.log('-----------------------\n\n')
            //term.clear()
            const ipDiscovery = new IPDiscovery(options.interface)
            const discoveryTimeout = options.discoverTime
            const services = []
            ipDiscovery.on('serviceUp', (service) => {
                services.push(service)
            })
            ipDiscovery.start()

            let discoveryTime = 0
            const progressBar = new cliProgress.SingleBar({ format: 'Discovering services | {bar} | {percentage}% | ETA: {eta}s', hideCursor: false }, cliProgress.Presets.rect)

            progressBar.start(100, 0)

            const discoveryInterval = setInterval(() => {
                discoveryTime++
                progressBar.update((discoveryTime / discoveryTimeout) * 100)

                if (discoveryTime >= discoveryTimeout) {
                    progressBar.stop()
                    clearInterval(discoveryInterval)
                    ipDiscovery.stop()

                    resolve(services)
                }
            }, 1000)
        })

    const services = await discover()
    if (services.length === 0) {
        console.error('No Devices were found!!')
        process.exit()
    }

    const selectService = (services) =>
        new Promise((resolve, reject) => {
            console.log('\n\n')
            console.log('Please select a Device for pairing:')

            const serviceMenuItems = services.map((service) => `${service.name} (${service.id})`)
            serviceMenuItems.push('[CANCEL]')
            cliSelect(
                {
                    values: serviceMenuItems,
                    indentation: 2,
                },
                (response) => {
                    if (response.id === serviceMenuItems.length - 1) {
                        resolve(null)
                    }
                    const service = services[response.id]
                    resolve(service)
                }
            )
        })

    const service = await selectService(services)
    if (service === null) {
        console.log('Operation Cancled!')
        process.exit(0)
    }

    const pairService = (service) =>
        new Promise((resolve, reject) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            })
            console.clear()
            rl.question(`Enter PIN for ${service.name} (XXX-XX-XXX or XXXX-XXXX or XXXXXXXX): `, async (pin) => {
                const pinex = /(\d{3})-(\d{2})-(\d{3})|(\d{4})-(\d{4})|(\d{8})/
                let m = ((pin || '').match(pinex) || []).filter((e) => e !== undefined)
                if (m.length == 4) {
                    pin = m[0]
                } else if (m.length == 3) {
                    const p = m[1] + m[2]
                    pin = p.substr(0, 3) + '-' + p.substr(3, 2) + '-' + p.substr(5, 3)
                } else if (m.length == 2) {
                    const p = m[0]
                    pin = p.substr(0, 3) + '-' + p.substr(3, 2) + '-' + p.substr(5, 3)
                } else {
                    reject('Invalid Pin: ', pin)
                }
                console.log(`Pin: ${pin}`)
                rl.close()

                const discovery = new IPDiscovery()
                const pairMethod = await discovery.getPairMethod(service)
                const ipClient = new HttpClient(service.id, service.address, service.port)

                try {
                    await ipClient.pairSetup(pin, pairMethod)
                    resolve(ipClient)
                } catch (error) {
                    if (error.includes('M2: Error: 6')) {
                        console.log('Check how to fix (M2 Error 6) here: https://github.com/minamoanes/homebridge-homekit-control#how-to-fix-known-errors')
                    }
                    reject(`${error} \n \n For further support check here: https://github.com/minamoanes/homebridge-homekit-control`)
                }
            })
        })

    const client = await pairService(service)

    const saveServiceData = (service, client) =>
        new Promise((resolve, reject) => {
            console.log('\n\n')
            const pairingData = client.getLongTermData()

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            })

            rl.question(`Enter service data file name for saving: `, async function (file) {
                console.log('Creating file:', file)
                const accessories = await client.getAccessories()
                const data = {
                    id: service.id,
                    name: service.name,
                    address: service.address,
                    port: service.port,
                    enableHistory: false,
                    pairingData,
                    accessories,
                }
                rl.close()
                fs.writeFileSync(file, JSON.stringify(data, null, 4))
                resolve(data)
            })
            rl.write(`${service.id}.json`.replace(/:/g, '-'))
            // const pairingData = client.getLongTermData()
            // term('Enter service data file name for saving: ')

            // term.inputField(
            //     {
            //         default: `${service.id}.json`.replace(/:/g, '-'),
            //     },
            //     async (error, input) => {
            //         const accessories = await client.getAccessories()
            //         const data = {
            //             id: service.id,
            //             name: service.name,
            //             address: service.address,
            //             port: service.port,
            //             enableHistory: false,
            //             pairingData,
            //             accessories,
            //         }

            //         fs.writeFileSync(input, JSON.stringify(data, null, 4))
            //         resolve(data)
            //     }
            // )
        })

    const data = await saveServiceData(service, client)
    console.log('\n\n')
    console.log('Paired with Service:')
    console.log(data)
    process.exit()

    // const dataFile = 'data.json';
    // const serviceId = '07:04:16:30:05:14';
    // const servicePin = '151-21-988';

    // let data = {};
    // /*
    //     [id] => {
    //         address,
    //         port,
    //         pairingData,
    //         accessories
    //     }
    // */
    // if(fs.existsSync(dataFile))
    // {
    //     data = JSON.parse(fs.readFileSync(dataFile));
    //     const serviceData = data[serviceId];

    //     const ipClient = new HttpClient(
    //         serviceId,
    //         serviceData.address,
    //         serviceData.port,
    //         serviceData.pairingData
    //     );

    //     ipClient.getAccessories().then((accessories) => {
    //         console.log('Got accessories -> try persit data');
    //         data[serviceId].accessories = accessories;
    //         console.log(accessories);

    //         fs.writeFileSync(dataFile, JSON.stringify(data));

    //         console.log('OK');
    //         process.exit();
    //     }).catch((e) => console.error('getAccessories e', e));

    //     /*
    //     data = JSON.parse(fs.readFileSync(dataFile));

    //     console.log('Try connect ' + serviceId);
    //     const serviceData = data[serviceId];

    //     console.log({
    //         id: serviceId,
    //         address: serviceData.address,
    //         port: serviceData.port,
    //         pairingData: serviceData.pairingData
    //     })

    //     const ipSubscriberClient = new HttpClient(
    //         serviceId,
    //         serviceData.address,
    //         serviceData.port,
    //         serviceData.pairingData
    //     );

    //     ipSubscriberClient.on('event', (ev) => {
    //         console.log('[event]', ev);
    //     });

    //     ipSubscriberClient.subscribeCharacteristics(['2.10']).then((conn) => {
    //         connection = conn;
    //     }).catch((e) => console.error('subscribeCharacteristics', e));

    //     const ipClient = new HttpClient(
    //         serviceId,
    //         serviceData.address,
    //         serviceData.port,
    //         serviceData.pairingData
    //     );
    //     ipClient.setCharacteristics({
    //         '2.10': true
    //     }).then(() => {
    //         ipClient.getCharacteristics(
    //             ['2.10'],
    //             {
    //               meta: true,
    //               perms: true,
    //               type: true,
    //               ev: true,
    //             }
    //         ).then((characteristics) => {
    //             console.log(characteristics);
    //         }).catch((e) => console.error('getCharacteristics', e));
    //     }).catch((e) => console.error('setCharacteristics', e));

    //     */
    // } else {
    //     console.log('No data -> try discover');
    //     const ipDiscovery = new IPDiscovery();
    //     ipDiscovery.on('serviceUp', (service) => {
    //         console.log('Discovered ' + service.id + ' -> try pair');

    //         data[service.id] = {
    //             address: service.address,
    //             port: service.port,
    //             pairingData: {},
    //             accessories: {}
    //         };

    //         const ipClient = new HttpClient(service.id, service.address, service.port);

    //         ipClient.pairSetup(servicePin).then((r) => {

    //             const pairingData = ipClient.getLongTermData();
    //             console.log('pairingData', pairingData);
    //             console.log('Paired ' + service.id + ' -> try get accessories');

    //             data[service.id].pairingData = pairingData;

    //             ipClient.getAccessories().then((accessories) => {
    //                 console.log('Got ' + service.id + ' accessories -> try persit data');
    //                 console.log(accessories);
    //                 data[service.id].accessories = accessories;

    //                 fs.writeFileSync(dataFile, JSON.stringify(data));

    //                 console.log('OK');
    //                 process.exit();
    //             }).catch((e) => console.error('getAccessories', e));

    //         }).catch((e) => console.error('pairSetup', e));
    //     });
    //     ipDiscovery.start();
    // }
})()
