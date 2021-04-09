Install
===
```
npm i -g homebridge-homekit-controller

```

Pair devices
===
- Discover devices 
```
homekit [network interface]
```

example

```
homekit
```

or

```
homekit wlan0
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
- 
The Plugin currently supports the following Services:
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

All sensors available on any paired device are automatically dicovered when HomeBridge starts up.

Config
===
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

