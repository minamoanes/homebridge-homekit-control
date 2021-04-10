#!/usr/bin/env node

const sodium = require('libsodium-wrappers')

;(async () => {
    await sodium.ready

    const { IPDiscovery, HttpClient } = require('hap-controller')
    const term = require('terminal-kit').terminal

    const fs = require('fs')

    const discover = () =>
        new Promise((resolve, reject) => {
            term.clear()
            const ipDiscovery = new IPDiscovery(process.argv[2])
            const discoveryTimeout = 30
            const services = []
            ipDiscovery.on('serviceUp', (service) => {
                services.push(service)
            })
            ipDiscovery.start()

            let discoveryTime = 0
            progressBar = term.progressBar({
                width: 70,
                percent: true,
                eta: true,
                title: 'Discovering services',
                titleSize: 29,
            })

            const discoveryInterval = setInterval(() => {
                discoveryTime++
                progressBar.update(discoveryTime / discoveryTimeout)

                if (discoveryTime >= discoveryTimeout) {
                    clearInterval(discoveryInterval)
                    ipDiscovery.stop()

                    resolve(services)
                }
            }, 1000)
        })

    const services = await discover()
    if (services.length === 0) {
        process.exit()
    }

    const selectService = (services) =>
        new Promise((resolve, reject) => {
            term.clear()
            term('Please select a service:')
            const serviceMenuItems = services.map((service) => `${service.name} (${service.id})`)

            term.singleColumnMenu(serviceMenuItems, (error, response) => {
                const service = services[response.selectedIndex]
                resolve(service)
            })
        })

    const service = await selectService(services)

    const pairService = (service) =>
        new Promise((resolve, reject) => {
            term.clear()
            term('Enter PIN for ' + service.name + ' (XXX-XX-XXX): ')
            term.inputField({}, async (error, input) => {
                const ipClient = new HttpClient(service.id, service.address, service.port)

                await ipClient.pairSetup(input)

                resolve(ipClient)
            })
        })

    const client = await pairService(service)

    const saveServiceData = (service, client) =>
        new Promise((resolve, reject) => {
            term.clear()

            const pairingData = client.getLongTermData()
            term('Enter service data file name for saving: ')

            term.inputField(
                {
                    default: `${service.id}.json`.replace(/:/g, '-'),
                },
                async (error, input) => {
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

                    fs.writeFileSync(input, JSON.stringify(data, null, 4))
                    resolve(data)
                }
            )
        })

    const data = await saveServiceData(service, client)
    term.clear()
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
