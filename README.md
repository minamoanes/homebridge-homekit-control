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
- Select device, and enter code to pair
- Enter filename to save pairing's informations JSON
- Inside the JSON file, you can find

```
{
    "service": {
        "id": "device id",
        "name": "device name",
        "address": "device ip",
        "port": device-port
    },
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
- Note down the `"service"`, `"pairingData"`, and `"aid"` & `"iid"` under `"accessories"`.
- Get all the UUID here [https://gist.github.com/mplewis/def678dc4b6e63a86905](https://gist.github.com/mplewis/def678dc4b6e63a86905)
- Currently, I support `Switch`, `Motion sensor`, `Temperature sensor` and `Humidity sensor`. I will try to add more services!


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
				    },
					"accessories": [
						{
							"aid": "characteristic aid",
							"iid": "characteristic iid",
							"type" : "service type (eg. 00000082-0000-1000-8000-0026BB765291)",
							"name": "Humidity Sensor 1"
						}
					]
				}
			]
		}	
	]
}
```

