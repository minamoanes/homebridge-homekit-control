#!/usr/bin/env node

const cliSelect = require("cli-select");
const cliProgress = require("cli-progress");
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");
const readline = require("readline");

const optionDefinitions = [
  {
    name: "discoverTime",
    alias: "t",
    type: Number,
    defaultValue: 30,
    typeLabel: "{underline number} in s",
    description: "Time the device discovery runs in seconds",
  },
  {
    name: "interface",
    alias: "i",
    type: String,
    typeLabel: "{underline string}",
    description:
      "Name of the network device to listen for HomeKit items. For example: {italic wlan0}",
  },
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Print this usage guide.",
  },
];

const options = commandLineArgs(optionDefinitions);
if (options.help !== undefined) {
  const sections = [
    {
      header: "HomeKit Device Discovery",
      content:
        "Discovers available HomeKit devices on a network, pairs with them and writes the neccesary pairing-information into a file.",
    },
    {
      header: "Options",
      optionList: optionDefinitions,
    },
  ];
  const usage = commandLineUsage(sections);
  console.log(usage);
  process.exit(0);
}

(async () => {
  const { IPDiscovery, HttpClient } = require("hap-controller");

  const fs = require("fs");

  const discover = () =>
    new Promise((resolve, reject) => {
      console.clear();
      console.log("HomekitControl Device Discovery");
      console.log("-------------------------------\n\n");
      //term.clear()
      const ipDiscovery = new IPDiscovery(options.interface);
      const discoveryTimeout = options.discoverTime;
      const services = [];
      ipDiscovery.on("serviceUp", (service) => {
        services.push(service);
      });
      ipDiscovery.start();

      let discoveryTime = 0;
      const progressBar = new cliProgress.SingleBar(
        {
          format:
            "Discovering Homekit Accessories | {bar} | {percentage}% | ETA: {eta}s",
          hideCursor: false,
        },
        cliProgress.Presets.rect
      );

      progressBar.start(100, 0);

      const discoveryInterval = setInterval(() => {
        discoveryTime++;
        progressBar.update((discoveryTime / discoveryTimeout) * 100);

        if (discoveryTime >= discoveryTimeout) {
          progressBar.stop();
          clearInterval(discoveryInterval);
          ipDiscovery.stop();

          resolve(services);
        }
      }, 1000);
    });

  const services = await discover();
  if (services.length === 0) {
    console.error("No Devices were found!!");
    process.exit();
  }

  const selectService = (services) =>
    new Promise((resolve, reject) => {
      console.log("\n\n");
      console.log("Please select a Device for pairing:");

      const serviceMenuItems = services.map(
        (service) => `${service.name} (${service.id})`
      );
      serviceMenuItems.push("[CANCEL]");
      cliSelect(
        {
          values: serviceMenuItems,
          indentation: 2,
        },
        (response) => {
          if (response.id === serviceMenuItems.length - 1) {
            resolve(null);
          }
          const service = services[response.id];
          resolve(service);
        }
      );
    });

  const service = await selectService(services);
  if (service === null) {
    console.log("Operation Cancled!");
    process.exit(0);
  }

  const errorCallback = (error) => {
    console.log("\n\n-------------------------------\n");
    console.log(`\u274C ${error?.message}`);
    if (error?.message?.includes("M2: Error: 6")) {
      console.error(
        "=> Check how to fix the (M2: Error 6) here:\n  https://github.com/minamoanes/homebridge-homekit-control#how-to-fix-known-errors"
      );
    } else {
      console.error(
        `=> For further support check here:\n  https://github.com/minamoanes/homebridge-homekit-control`
      );
    }
    console.log("\n-------------------------------\n\n");
  };

  const pairService = (service) =>
    new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      console.clear();
      rl.question(
        `Enter PIN for ${service.name} (XXX-XX-XXX or XXXX-XXXX or XXXXXXXX): `,
        async (pin) => {
          const pinex = /(\d{3})-(\d{2})-(\d{3})|(\d{4})-(\d{4})|(\d{8})/;
          let m = ((pin || "").match(pinex) || []).filter(
            (e) => e !== undefined
          );
          if (m.length == 4) {
            pin = m[0];
          } else if (m.length == 3) {
            const p = m[1] + m[2];
            pin = p.substr(0, 3) + "-" + p.substr(3, 2) + "-" + p.substr(5, 3);
          } else if (m.length == 2) {
            const p = m[0];
            pin = p.substr(0, 3) + "-" + p.substr(3, 2) + "-" + p.substr(5, 3);
          } else {
            reject("Invalid Pin: ", pin);
          }
          console.log(`Pin: ${pin}`);
          rl.close();

          const discovery = new IPDiscovery();
          const pairMethod = await discovery.getPairMethod(service);
          const ipClient = new HttpClient(
            service.id,
            service.address,
            service.port
          );

          ipClient.setCharacteristics({
            "2.10": true,
            iid: service.id,
          });

          try {
            await ipClient.pairSetup(pin, pairMethod);
            resolve(ipClient);
          } catch (error) {
            errorCallback(error);
          }
        }
      );
    });

  const client = await pairService(service);

  const saveServiceData = (service, client) =>
    new Promise((resolve, reject) => {
      console.log("\n\n");
      const pairingData = client.getLongTermData();

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`Enter service data file name for saving: `, async (file) => {
        console.log("Creating file:", file);
        const accessories = await client.getAccessories();
        const data = {
          id: service.id,
          name: service.name,
          address: service.address,
          port: service.port,
          enableHistory: false,
          pairingData,
          accessories,
        };
        rl.close();
        fs.writeFileSync(file, JSON.stringify(data, null, 4));
        resolve(data);
      });
      rl.write(`${service.id}.json`.replace(/:/g, "-"));
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
    });

  const data = await saveServiceData(service, client);
  console.log("\n\n");
  console.log("Paired with Service:");
  console.log(data);
  process.exit();
})();
