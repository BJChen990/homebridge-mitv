import { TV, Keys } from './tv';
import {
  API,
  Logger,
  AccessoryConfig,
  Characteristic,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

function appleToMiKey(key: number) {
  const { RemoteKey } = Characteristic.RemoteKey;
  switch (key) {
    case RemoteKey.ARROW_UP:
      return Keys.UP;
    case RemoteKey.ARROW_DOWN:
      return Keys.DOWN;
    case RemoteKey.ARROW_LEFT:
      return Keys.LEFT;
    case RemoteKey.ARROW_RIGHT:
      return Keys.RIGHT;
    case RemoteKey.SELECT:
    case RemoteKey.PLAY_PAUSE:
      return Keys.ENTER;
    case RemoteKey.BACK:
      return Keys.BACK;
    case RemoteKey.EXIT:
      return Keys.HOME;
    case RemoteKey.INFORMATION:
      return Keys.MENU;
  }
  throw new Error(`Invalid key: ${key}`);
}

const DEFAULT_VOLUME = 10;

export class MiTVAccessory {
  private readonly tvClient: TV;
  private volumeBeforeMute: number | undefined;

  constructor(
    private readonly logger: Logger,
    private readonly config: AccessoryConfig,
    private readonly homebridge: API
  ) {
    this.tvClient = new TV(config.ip);
  }

  get name() {
    return this.config.name || 'Mi TV';
  }

  private getActive = async (callback: CharacteristicGetCallback) => {
    try {
      await this.tvClient.status();
      callback(null, true);
    } catch (_) {
      callback(null, false);
    }
  };

  private setActive = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      if (value) {
        throw new Error('Activate mi TV is not supported');
      }
      await this.tvClient.powerOff();
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private pressKey = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    const key = appleToMiKey(value as number);
    this.logger.debug(`Pressing Key: ${key}`);
    try {
      await this.tvClient.pressKey(key);
      this.logger.debug(`Successfully pressed key: ${key}`);
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private setSource = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      if (value === 1) {
        await this.tvClient.pressKey(Keys.HOME);
      } else if (value <= 3) {
        await this.tvClient.changeSource(value === 2 ? 'hdmi1' : 'hdmi2');
      }
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private getMuted = async (callback: CharacteristicGetCallback) => {
    try {
      const { volum } = await this.tvClient.getVolume();
      callback(null, volum === 0);
    } catch (err) {
      callback(err);
    }
  };

  private setMuted = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      if (value) {
        const { volum } = await this.tvClient.getVolume();
        this.volumeBeforeMute = volum;
        this.tvClient.setVolume(0);
      } else {
        this.tvClient.setVolume(this.volumeBeforeMute ?? DEFAULT_VOLUME);
        this.volumeBeforeMute = undefined;
      }
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private getVolume = async (
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) => {
    try {
      await this.tvClient.setVolume(value as number);
      callback(null);
    } catch (err) {
      callback(err);
    }
  };

  private setVolume = async (callback: CharacteristicGetCallback) => {
    try {
      const { volum } = await this.tvClient.getVolume();
      callback(null, volum);
    } catch (err) {
      callback(err);
    }
  };

  getServices() {
    const { Service, CharacteristicEventTypes } = this.homebridge.hap;
    const id = this.homebridge.hap.uuid.generate(this.name);
    const tvService = new Service.Television(this.name, 'Screen');
    tvService.setCharacteristic(Characteristic.ConfiguredName, this.name);
    tvService.setCharacteristic(
      Characteristic.SleepDiscoveryMode,
      Characteristic.SleepDiscoveryMode.NOT_DISCOVERABLE
    );
    tvService
      .getCharacteristic(Characteristic.Active)
      .on(CharacteristicEventTypes.GET, this.getActive)
      .on(CharacteristicEventTypes.SET, this.setActive);
    tvService
      .getCharacteristic(Characteristic.RemoteKey)
      .on(CharacteristicEventTypes.SET, this.pressKey);
    tvService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .on(CharacteristicEventTypes.SET, this.setSource);
    tvService
      .getCharacteristic(Characteristic.PictureMode)!
      .on(
        CharacteristicEventTypes.SET,
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback
        ) => {
          console.log('set PictureMode => setNewValue: ' + newValue);
          callback(null);
        }
      );
    tvService
      .getCharacteristic(Characteristic.PowerModeSelection)!
      .on(
        CharacteristicEventTypes.SET,
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback
        ) => {
          console.log('set PowerModeSelection => setNewValue: ' + newValue);
          callback(null);
        }
      );

    /**
     * The speaker is not working at the moment 🤷‍♂️.
     */
    const tvVolumeService = new Service.TelevisionSpeaker(this.name, 'Speaker');
    tvVolumeService
      .getCharacteristic(Characteristic.Mute)
      .on(CharacteristicEventTypes.GET, this.getMuted)
      .on(CharacteristicEventTypes.SET, this.setMuted);
    tvVolumeService
      .getCharacteristic(Characteristic.Active)
      .on(CharacteristicEventTypes.SET, this.setActive);
    tvVolumeService
      .getCharacteristic(Characteristic.Volume)
      .on(CharacteristicEventTypes.GET, this.getVolume)
      .on(CharacteristicEventTypes.SET, this.setVolume);
    tvVolumeService
      .setCharacteristic(
        Characteristic.VolumeControlType,
        Characteristic.VolumeControlType.ABSOLUTE
      )
      .setCharacteristic(
        Characteristic.VolumeSelector,
        Characteristic.VolumeSelector.INCREMENT
      );

    const homeScreenSource = new Service.InputSource('mi-tv', 'Mi TV');
    homeScreenSource
      .setCharacteristic(Characteristic.Identifier, 1)
      .setCharacteristic(Characteristic.ConfiguredName, 'Mi TV')
      .setCharacteristic(
        Characteristic.IsConfigured,
        Characteristic.IsConfigured.CONFIGURED
      )
      .setCharacteristic(
        Characteristic.InputSourceType,
        Characteristic.InputSourceType.HOME_SCREEN
      );

    const inputHDMI1 = new Service.InputSource('hdmi1', 'HDMI 1');
    inputHDMI1
      .setCharacteristic(Characteristic.Identifier, 2)
      .setCharacteristic(Characteristic.ConfiguredName, 'HDMI 1')
      .setCharacteristic(
        Characteristic.IsConfigured,
        Characteristic.IsConfigured.CONFIGURED
      )
      .setCharacteristic(
        Characteristic.InputSourceType,
        Characteristic.InputSourceType.HDMI
      );

    const inputHDMI2 = new Service.InputSource('hdmi2', 'HDMI 2');
    inputHDMI2
      .setCharacteristic(Characteristic.Identifier, 3)
      .setCharacteristic(Characteristic.ConfiguredName, 'HDMI 2')
      .setCharacteristic(
        Characteristic.IsConfigured,
        Characteristic.IsConfigured.CONFIGURED
      )
      .setCharacteristic(
        Characteristic.InputSourceType,
        Characteristic.InputSourceType.HDMI
      );

    tvService.addLinkedService(homeScreenSource);
    tvService.addLinkedService(inputHDMI1);
    tvService.addLinkedService(inputHDMI2);

    const informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi');
    return [
      tvService,
      informationService,
      tvVolumeService,
      homeScreenSource,
      inputHDMI1,
      inputHDMI2,
    ];
  }
}
