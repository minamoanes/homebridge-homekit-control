<div align="center">

<img src="https://developer.apple.com/assets/elements/icons/homekit/homekit-96x96_2x.png" width="100px" />
<img src="https://cdn-icons-png.flaticon.com/512/1294/1294463.png" width="50px" />
<img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" width="100px" />


# Homebridge HomeKit Control

<a href="https://www.npmjs.com/package/homebridge-homekit-control"><img title="npm version" src="https://badgen.net/npm/v/homebridge-homekit-control?label=stable"></a>
<a href="https://www.npmjs.com/package/homebridge-homekit-control"><img title="npm downloads" src="https://badgen.net/npm/dt/homebridge-homekit-control"></a>

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/MinaMoanes)

</div>

**HomeKit Control** allows you to control HomeKit enabled devices from Homebridge.

This is especially usefull if you want to control HomeKit Exclusive devices and accessories through:
- <img src="https://user-images.githubusercontent.com/17292320/180973891-14c38bef-4a17-4733-b103-3cf002755b69.png" width="20" /> **Google Assistant** (using `homebridge-gsh` plugin)
- <img src="https://user-images.githubusercontent.com/17292320/180974563-0fd9a3d9-6f4f-4d57-a7c2-9e61aea04903.png" width="20" /> **Amazon Alexa** (using `homebridge-alexa` plugin)
- and of course still controllable from <img src="https://user-images.githubusercontent.com/17292320/180978863-c58e839b-4d31-4860-8235-b69991767460.png" width="20" /> **Apple HomeKit** though Homebridge.


The Plugin currently supports the following Services provided by **WLAN**-based HomeKit enabled devices:

- `Switch`
- `Outlet`
- `Motion Sensors`
- `Temperatur Sensors`
- `Humidity Sensors`
- `CO2 Sensors`
- `Carbon Monoxid Sensors`
- `Air Quality Sensors`
- `Ambient Light Sensors`
- `Light Bulbs`
- `Battery/Charging State`

BLE is currently not supported, as it seems to be unstable when multiple BLE-enabled Plugins are installed.

All supported sensors on any configured device are automatically dicovered and added when HomeBridge starts up.

## Install

```
sudo npm i -g homebridge-homekit-control
```

## Pair devices

### Discover Devices

```
homekitPair [network] [interface]
```

#### Example

```
homekitPair
```

or

```
homekitPair -i wlan0
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

### Config

This Plugin supports the Configuration Interface in Homebridge UI (homebridge-config-ui-x). Simply add a new Device and paste the values you obtained above.

Here are some additional configuration parameters, not obtained by the Device Pairing:

- `services.enableHistory` (_boolean_): **true** will enable fakeGato for compatible Sensors. This will allow you to view a history in the EVE-App
- `services.historyInterval` (optional, _numeric_): Determins the Interval used to take readings. The valus range is **[30, 600]**. The default value is **600**
- `services.proxyAll`(optional, _boolean_): By default we only proxy tested services and characteristics from your devices. When this mode is enabled, all available services and characteristics are proxied. Be carefull when activating, this may cause damage to your devices. The default value is **false**
- `services.uniquePrefix`(optional, _string_): When a device is added to multiple HomeBridge instances in the same network, you will need to provide a unique prefix. Otherwise Eve-App will get confused.

#### Example

```
{
    "platforms": [
        {
            "platform": "HomekitControl",
            "services": [
                {
                    "id": "device id",
                    "name": "device name",
                    "address": "device ip",
                    "port": "device port",
                    "enableHistory": false,
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

## How to fix Known Errors:

**if you get the error `M2: Error: 6`:**

1. Add the device to your Homekit
2. Once the device is added and connected to your Wifi network
3. Remove device from your Home
4. Device should still be connected to your Wifi (check it from your router's connected clients)
5. Run the `homekitPair` command in your Homebridge and enter the pin
6. And voila, you get the JSON

## Tested Accesories

(!!! Use at your own risk !!!)

- Quingping Air Monitor Lite (Cleargrass Luftdetektor Lite, Cleargrass Air Monitor Lite)
- Nanoleaf Aurora / Light Panels
- Gardena Smart Control Hub
  - Gardena Smart Irrigation Control
  - Gardena Smart Sensor II

Please let me know if you use this plugin and got it to work with a new HomeKit-Accesory that is not listed above

## Building for developers

The project was converted to the build system from https://github.com/homebridge/homebridge-plugin-template. Visual Studio Code is set up to lint on save.

Using `npm run dev` will launch the develop environment, where your code is automatically compiled on save and the local homebridge server is automatically restarted.

The command `npm rund build` will trigger the compilation of your project manually.
