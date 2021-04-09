var Service, Characteristic, Accessory, UUIDGen

module.exports = function(homebridge) {
    console.log('homebridge API version: ' + homebridge.version)    

    // Accessory must be created from PlatformAccessory Constructor
    Accessory = homebridge.platformAccessory

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic    
   

    const HKPlatform = require('./HomeKitPlatform.js')(Service, Characteristic).HKPlatform
        
    homebridge.registerPlatform('homebridge-homekit-controller', 'HomeKitController', HKPlatform, true)
}
