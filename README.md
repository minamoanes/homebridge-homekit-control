The Plugin currently supports the following Services provided by **WLAN**-based HomeKit enabled devices:
 - `Switch`
 - `Outlet`
 - `Motion Sensors`
 - `Temperatur Sensors`
 - `Humidity Sensors`
 - `CO2 Sensors`
-  `Carbon Monoxid Sensors`
 - `Air Quality Sensors`
 - `Ambient Light Sensors`
 - `Light Bulbs`
 - `Battery/Charging State`

BLE is currently not supported, as it seems to be unstable when multiple BLE-enabled Plugins are installed.

All supported sensors on any configured device are automatically dicovered and added when HomeBridge starts up.
# Install
```
npm i -g homebridge-homekit-controller

```

# Pair devices

## Discover Devices
```
node cli.js [network interface]
```

### Example

```
node cli.js
```

or

```
node cli.js wlan0
```

- Select device, and enter code to pair (including `-`, example `123-45-678`)
- Enter filename to save pairing's informations JSON
- Inside the JSON file, you can find

```
{
    "id": "device id",
    "name": "device name",
    "address": "device ip",
    "port": device-port,
    "pairingData": {
        "AccessoryPairingID": "xxx",
        "AccessoryLTPK": "xxx",
        "iOSDevicePairingID": "xxx",
        "iOSDeviceLTSK": "xxx",
        "iOSDeviceLTPK": "xxx"
    },
    "accessories": {
        "accessories": [...]
    }
}
```
- Note down the `"id"`, `"name"`, `"address"`, `"port"` and `"pairingData"`
  



## Config

- `services.historyInterval` (*numeric*): **0** will disable fakeGato, any other positive value (in seconds) will enable the fakeGato-Service for compatible Sensors. This will allow you to view a history in the Eve-App. The valus range is **[30, 600]**.
- `services.uniquePrefix`(optional, *string*): When a device is added to multiple HomeBridge instances in the same network, you will need to provide a unique prefix. Otherwise Eve-App will get confused.

### Example
```
{
    "platforms": [
        {
            "platform": "HomeKitController",            
            "services": [
                {
                    "id": "device id",
                    "name": "device name",
                    "address": "device ip",
                    "port": "device port",
                    "historyInterval": 0
                    "pairingData": {
                        "AccessoryPairingID": "xxx",
                        "AccessoryLTPK": "xxx",
                        "iOSDevicePairingID": "xxx",
                        "iOSDeviceLTSK": "xxx",
                        "iOSDeviceLTPK": "xxx"
                    }
                }
            ]
        }    
    ]
}
```

# Building
The project was converted to the build system from https://github.com/homebridge/homebridge-plugin-template. Visual Studio Code is set up to lint on save. 

Using `npm run dev` will launch the develop environment, where your code is automatically compiled on save and the local homebridge server is automatically restarted.

The command `npm rund build` will trigger the compilation of your project manually.

# Tested Accesories

- Quingping Air Monitor Lite (Cleargrass Luftdetektor Lite, Cleargrass Air Monitor Lite)

Please let me know if you use this plugin and got it to work with a new HomeKit-Accesory that is not listed above