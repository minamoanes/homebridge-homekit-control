"use strict";

const sodium = require('libsodium-wrappers');
const {HttpClient} = require('hap-controller');

var Service, Characteristic, HomebridgeAPI;

module.exports = (homebridge) => {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	HomebridgeAPI = homebridge;
	homebridge.registerPlatform("homekit-controller", "HomeKitController", ControllerPlatform);
}

const sleep = (seconds) => new Promise(resolver => setTimeout(resolver, seconds * 1000))

function ControllerPlatform(log, config) {
	this.log = log;
	// this.log = () => {};
	this.config = config;
	this.hbAccessories = [];
	this.clients = [];

	const services = this.config.services;

	for(var service of services)
	{
		const accessories = service.accessories;

		const client = new HttpClient(
			service.id, 
			service.address, 
			service.port, 
			service.pairingData
		)
		client.accessoryNames = {}
		client.cachedValue = {}

		for(var accessory of accessories)
		{
			const characteristic = accessory.aid + '.' + accessory.iid;

			client.accessoryNames[characteristic] = accessory.name

			if(accessory.type === '00000049-0000-1000-8000-0026BB765291')
			{
				// Switch
				const hbService = new Service.Switch(accessory.name);

				hbService.getCharacteristic(Characteristic.On)
					.on('set', async (value, callback) => {
						try {
							await client.setCharacteristics({
								[characteristic]: value
							});

							client.cachedValue[characteristic] = value

							this.log('[set] Switch ' + client.accessoryNames[characteristic] + ' setCharacteristics ' + characteristic + ' -> ' + value + ' => ok')
							callback(null);
						} catch(e){
							callback(null);
							this.log('[set] Switch ' + client.accessoryNames[characteristic] + ' setCharacteristics ' + characteristic + ' -> ' + value + ' => error', e)
						}
					})
					.on('get', async (callback) => {
						try {
							let callbacked = false

							if(client.cachedValue && client.cachedValue[characteristic])
							{
								this.log('[get] Switch ' + client.accessoryNames[characteristic] + ' cachedValue ' + characteristic + ' = ' + client.cachedValue[characteristic] + ' => ok')
								callback(null, client.cachedValue[characteristic])
								callbacked = true
								return
							}


							const result = await client.getCharacteristics([characteristic])

							client.cachedValue = client.cachedValue || {}
							client.cachedValue[characteristic] = result.characteristics[0].value

							this.log('[get] Switch ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' = ' + result.characteristics[0].value + ' => ok')

							if(!callbacked)
							{
								callback(null, result.characteristics[0].value)
							}
						} catch(e) {
							callback(null, false);
							this.log('[get] Switch ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' => error', e)
						}
					});
				

				const hbAccessory = {
					name: accessory.name,
					type: accessory.type,
					serviceId: service.id,
					characteristic
				}

				hbAccessory.getServices = () => [hbService];

				this.hbAccessories.push(hbAccessory);
			}
			else if(accessory.type === '00000011-0000-1000-8000-0026BB765291')
			{
				// Temperature
				const hbService = new Service.TemperatureSensor(accessory.name);

				hbService.getCharacteristic(Characteristic.CurrentTemperature)
					.on('get', async (callback) => {
						try {
							let callbacked = false
							if(client.cachedValue && client.cachedValue[characteristic])
							{
								this.log('[get] Temperature ' + client.accessoryNames[characteristic] + ' cachedValue ' + characteristic + ' = ' + client.cachedValue[characteristic] + ' => ok')
								callback(null, client.cachedValue[characteristic])
								callbacked = true
								return
							}

							const result = await client.getCharacteristics([characteristic])


							client.cachedValue[characteristic] = result.characteristics[0].value

							this.log('[get] Temperature ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' = ' + result.characteristics[0].value + ' => ok')
							
							if(!callbacked)
							{
								callback(null, result.characteristics[0].value)
							}
						} catch(e) {
							callback(false);
							this.log('[get] Temperature ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' => error', e)
						}
					});
				

				const hbAccessory = {
					name: accessory.name,
					type: accessory.type,
					serviceId: service.id,
					characteristic
				}

				hbAccessory.getServices = () => [hbService];

				this.hbAccessories.push(hbAccessory);
			}
			else if(accessory.type === '00000082-0000-1000-8000-0026BB765291')
			{
				// Humidity
				const hbService = new Service.HumiditySensor(accessory.name);

				hbService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
					.on('get', async (callback) => {
						try {

							let callbacked = false
							if(client.cachedValue && client.cachedValue[characteristic])
							{
								this.log('[get] Humidity ' + client.accessoryNames[characteristic] + ' cachedValue ' + characteristic + ' = ' + client.cachedValue[characteristic] + ' => ok')
								callback(null, client.cachedValue[characteristic])
								callbacked = true
								return
							}

							const result = await client.getCharacteristics([characteristic])


							client.cachedValue = client.cachedValue || {}
							client.cachedValue[characteristic] = result.characteristics[0].value


							this.log('[get] Humidity ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' = ' + result.characteristics[0].value + ' => ok')
							
							if(!callbacked)
							{
								callback(null, result.characteristics[0].value)
							}
						} catch(e) {
							callback(false);
							this.log('[get] Humidity ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' => error', e)
						}
					});
				

				const hbAccessory = {
					name: accessory.name,
					type: accessory.type,
					serviceId: service.id,
					characteristic
				}

				hbAccessory.getServices = () => [hbService];

				this.hbAccessories.push(hbAccessory);
			}
			else if(accessory.type === '00000085-0000-1000-8000-0026BB765291')
			{
				// Motion
				const hbService = new Service.MotionSensor(accessory.name);

				hbService.getCharacteristic(Characteristic.MotionDetected)
					.on('get', async (callback) => {
						try {
							/*
							// no cache due to race conditions
							let callbacked = false
							if(client.cachedValue && client.cachedValue[characteristic])
							{
								this.log('Motion cachedValue ' + characteristic + ' = ' + client.cachedValue[characteristic] + ' => ok')
								callback(null, client.cachedValue[characteristic])
								callbacked = true
								return
							}
							

							const result = await client.getCharacteristics([characteristic])


							client.cachedValue = client.cachedValue || {}
							client.cachedValue[characteristic] = result.characteristics[0].value

							
							this.log('Motion getCharacteristics ' + characteristic + ' = ' + result.characteristics[0].value + ' => ok')
							
							if(!callbacked)
							{
								callback(null, result.characteristics[0].value)
							}
							*/

							const result = await client.getCharacteristics([characteristic])
							this.log('[get] Motion ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' = ' + result.characteristics[0].value + ' => ok')

							callback(null, result.characteristics[0].value)
						} catch(e) {
							callback(false);
							this.log('[get] Motion ' + client.accessoryNames[characteristic] + ' getCharacteristics ' + characteristic + ' => error', e)
						}
					});

					

				const hbAccessory = {
					name: accessory.name,
					type: accessory.type,
					serviceId: service.id,
					characteristic
				}

				hbAccessory.getServices = () => [hbService];

				this.hbAccessories.push(hbAccessory);
			}
		}

		this.clients[service.id] = client;
	}
}

ControllerPlatform.prototype.accessories = async function(callback) {
	await sodium.ready;

	this.log("accessories")

	const update = async (accessoryType = null) => {
		this.log("update")
		for(let hbAccessory of this.hbAccessories)
		{
			const type = hbAccessory.type;
			if((accessoryType === null || accessoryType === type) && type === '00000049-0000-1000-8000-0026BB765291')
			{
				// Switch
				const name = hbAccessory.name;
				const hbService = hbAccessory.getServices()[0];
				const characteristic = hbAccessory.characteristic;
				const serviceId = hbAccessory.serviceId;
				const client = this.clients[serviceId];

				try {
					const result = await client.getCharacteristics([characteristic])
					this.log('[update] Switch ' + name + ' getCharacteristics ' + characteristic + ' -> ' + result.characteristics[0].value + ' = ok')

					if(!client.cachedValue || client.cachedValue[characteristic] !== result.characteristics[0].value)
					{
						client.cachedValue = client.cachedValue || {}
						client.cachedValue[characteristic] = result.characteristics[0].value
	
						hbService.setCharacteristic(Characteristic.On, result.characteristics[0].value);
					}
				} catch(e) {
					this.log('[update] Switch ' + name + ' getCharacteristics ' + characteristic + ' = error', e)
				}



				try {
					client
					.on('event', event => {
						this.log('[event] Switch ' + name + ' got event', event);

						if(event.characteristics && event.characteristics[0])
						{
							if(characteristic === event.characteristics[0].aid + '.' + event.characteristics[0].iid)
							{
								if(!client.cachedValue || client.cachedValue[characteristic] !== result.characteristics[0].value)
								{
	
									client.cachedValue = client.cachedValue || {}
									client.cachedValue[characteristic] = event.characteristics[0].value

									this.log('[event] Switch ' + name + ' setCharacteristic', characteristic, event.characteristics[0].value);
	
									hbService.setCharacteristic(Characteristic.On, event.characteristics[0].value);
								}
							}
						}
					})
					.on('disconnect', async () => {
						this.log('[disconnect] Switch ' + name + ' disconnected');

						// let reconnected = false
						// while(!reconnected)
						// {
						// 	await delay(1)

						// 	try {
						// 		this.log('Switch ' + name + ' reconnecting')
						// 		await client.subscribeCharacteristics([characteristic])
						// 		this.log('Switch ' + name + ' update subscribeCharacteristics ' + characteristic + ' = ok')
						// 		reconnected = true
						// 	} catch(e) {
						// 		this.log('Switch ' + name + ' update subscribeCharacteristics ' + characteristic + ' = error', e)
						// 	}
						// }
					})

					const connection = await client.subscribeCharacteristics([characteristic])

					this.log('[update] Switch ' + name + ' subscribeCharacteristics ' + characteristic + ' = ok')
				} catch(e) {
					this.log('[update] Switch ' + name + ' subscribeCharacteristics ' + characteristic + ' = error', e)
				}
			}
			else if((accessoryType === null || accessoryType === type) && type === '00000011-0000-1000-8000-0026BB765291')
			{
				// Temperature
				const name = hbAccessory.name;
				const hbService = hbAccessory.getServices()[0];
				const characteristic = hbAccessory.characteristic;
				const serviceId = hbAccessory.serviceId;
				const client = this.clients[serviceId];

				try {
					const result = await client.getCharacteristics([characteristic])
					this.log('[update] Temperature ' + name + ' getCharacteristics ' + characteristic + ' -> ' + result.characteristics[0].value + ' = ok')

					if(!client.cachedValue || client.cachedValue[characteristic] !== result.characteristics[0].value)
					{
						client.cachedValue = client.cachedValue || {}
						client.cachedValue[characteristic] = result.characteristics[0].value
	
						hbService.setCharacteristic(Characteristic.CurrentTemperature, result.characteristics[0].value);
					}
				} catch(e) {
					this.log('[update] Temperature ' + name + ' getCharacteristics ' + characteristic + ' = error', e)
				}

				try {
					client
					.on('event', event => {
						this.log('[event] Temperature ' + name + ' got event', event);

						if(event.characteristics && event.characteristics[0])
						{
							if(characteristic === event.characteristics[0].aid + '.' + event.characteristics[0].iid)
							{
								if(!client.cachedValue || client.cachedValue[characteristic] !== event.characteristics[0].value)
								{
									client.cachedValue = client.cachedValue || {}
									client.cachedValue[characteristic] = result.characteristics[0].value
				
									this.log('[event] Temperature ' + name + ' setCharacteristic', characteristic, event.characteristics[0].value);

									hbService.setCharacteristic(Characteristic.CurrentTemperature, event.characteristics[0].value);
								}
							}
						}
					})
					.on('disconnect', async () => {
						this.log('[disconnect] Switch ' + name + ' disconnected');

						// let reconnected = false
						// while(!reconnected)
						// {
						// 	await delay(1)

						// 	try {
						// 		this.log('Temperature ' + name + ' reconnecting')
						// 		await client.subscribeCharacteristics([characteristic])
						// 		this.log('Temperature ' + name + ' update subscribeCharacteristics ' + characteristic + ' = ok')
						// 		reconnected = true
						// 	} catch(e) {
						// 		this.log('Temperature ' + name + ' update subscribeCharacteristics ' + characteristic + ' = error', e)
						// 	}
						// }
					})

					const connection = await client.subscribeCharacteristics([characteristic])

					this.log('[update] Temperature ' + name + ' subscribeCharacteristics ' + characteristic + ' = ok')
				} catch(e) {
					this.log('[update] Temperature ' + name + ' subscribeCharacteristics ' + characteristic + ' = error', e)
				}
			}
			else if((accessoryType === null || accessoryType === type) && type === '00000082-0000-1000-8000-0026BB765291')
			{
				// Humidity
				const name = hbAccessory.name;
				const hbService = hbAccessory.getServices()[0];
				const characteristic = hbAccessory.characteristic;
				const serviceId = hbAccessory.serviceId;
				const client = this.clients[serviceId];

				try {
					const result = await client.getCharacteristics([characteristic])
					this.log('[update] Humidity ' + hbAccessory.name + ' getCharacteristics ' + characteristic + ' -> ' + result.characteristics[0].value + ' = ok')
					
					if(!client.cachedValue || client.cachedValue[characteristic] !== result.characteristics[0].value)
					{
						client.cachedValue = client.cachedValue || {}
						client.cachedValue[characteristic] = result.characteristics[0].value
	
						hbService.setCharacteristic(Characteristic.CurrentRelativeHumidity, result.characteristics[0].value);
					}
				} catch(e) {
					this.log('[update] Humidity ' + hbAccessory.name + ' getCharacteristics ' + characteristic + ' = error', e)
				}


				try {
					client
					.on('event', event => {
						this.log('[event] Humidity ' + name + ' got event', event);

						if(event.characteristics && event.characteristics[0])
						{
							if(characteristic === event.characteristics[0].aid + '.' + event.characteristics[0].iid)
							{
								if(!client.cachedValue || client.cachedValue[characteristic] !== event.characteristics[0].value)
								{
									client.cachedValue = client.cachedValue || {}
									client.cachedValue[characteristic] = result.characteristics[0].value
				
									this.log('[event] Humidity ' + name + ' setCharacteristic', characteristic, event.characteristics[0].value);

									hbService.setCharacteristic(Characteristic.CurrentRelativeHumidity, event.characteristics[0].value);
								}
							}
						}
					})
					.on('disconnect', async () => {
						this.log('[disconnect] Humidity ' + name + ' disconnected');

						
						// let reconnected = false
						// while(!reconnected)
						// {
						// 	await delay(1)

						// 	try {
						// 		this.log('Humidity ' + name + ' reconnecting')
						// 		await client.subscribeCharacteristics([characteristic])
						// 		this.log('Humidity ' + name + ' update subscribeCharacteristics ' + characteristic + ' = ok')
						// 		reconnected = true
						// 	} catch(e) {
						// 		this.log('Humidity ' + name + ' update subscribeCharacteristics ' + characteristic + ' = error', e)
						// 	}
						// }
					})

					const connection = await client.subscribeCharacteristics([characteristic])

					this.log('[update] Humidity ' + name + ' subscribeCharacteristics ' + characteristic + ' = ok')
				} catch(e) {
					this.log('[update] Humidity ' + name + ' subscribeCharacteristics ' + characteristic + ' = error', e)
				}
			}
			else if((accessoryType === null || accessoryType === type) && type === '00000085-0000-1000-8000-0026BB765291')
			{
				// Motion
				const name = hbAccessory.name;
				const hbService = hbAccessory.getServices()[0];
				const characteristic = hbAccessory.characteristic;
				const serviceId = hbAccessory.serviceId;
				const client = this.clients[serviceId];

				try {
					const result = await client.getCharacteristics([characteristic])
					this.log('[update] Motion ' + hbAccessory.name + ' getCharacteristics ' + characteristic + ' -> ' + result.characteristics[0].value + ' = ok')
					
					
					/*
					client.cachedValue = client.cachedValue || {}
					client.cachedValue[characteristic] = result.characteristics[0].value
					*/

					hbService.setCharacteristic(Characteristic.MotionDetected, result.characteristics[0].value);
				} catch(e) {
					this.log('[update] Motion ' + hbAccessory.name + ' getCharacteristics ' + characteristic + ' = error', e)
				}


				try {
					client
					.on('event', event => {
						this.log('[event] Motion ' + name + ' got event', event);

						if(event.characteristics && event.characteristics[0])
						{
							if(characteristic === event.characteristics[0].aid + '.' + event.characteristics[0].iid)
							{
								/*
								client.cachedValue = client.cachedValue || {}
								client.cachedValue[characteristic] = event.characteristics[0].value
								*/

								this.log('[event] Motion ' + name + ' setCharacteristic', characteristic, event.characteristics[0].value);
								hbService.setCharacteristic(Characteristic.MotionDetected, event.characteristics[0].value);
							}
						}
					})
					.on('disconnect', async () => {
						this.log('[disconnect] Motion ' + name + ' disconnected');
 
						// let reconnected = false
						// while(reconnected)
						// {
						// 	await delay(1)

						// 	try {
						// 		this.log('Motion ' + name + ' reconnecting')
						// 		await client.subscribeCharacteristics([characteristic])
						// 		this.log('Motion ' + name + ' update subscribeCharacteristics ' + characteristic + ' = ok')
						// 		reconnected = true
						// 	} catch(e) {
						// 		this.log('Motion ' + name + ' update subscribeCharacteristics ' + characteristic + ' = error', e)
						// 	}

							
						// }
					})

					const connection = await client.subscribeCharacteristics([characteristic])

					this.log('[update] Motion ' + name + ' subscribeCharacteristics ' + characteristic + ' = ok')
				} catch(e) {
					this.log('[update] Motion ' + name + ' subscribeCharacteristics ' + characteristic + ' = error', e)
				}
			}
		}
	}

	update(null)
	
	
	callback(this.hbAccessories);
}
