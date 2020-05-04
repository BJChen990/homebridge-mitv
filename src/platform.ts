import { API, AccessoryPlugin, AccessoryConfig, Logger } from 'homebridge';
import { MiTVAccessory } from './accessory';
import { PlatformPlugin, StaticPlatformPlugin } from 'homebridge/lib/api';

function registerPlatform(homebridge: API) {
  homebridge.registerPlatform('homebridge-mitv', 'MiTVPlatform', MiTVPlatform);
}

interface TVPlugin extends PlatformPlugin {
  tvs?: TV[];
  tv?: TV;
}

type TV = {};

class MiTVPlatform implements StaticPlatformPlugin {
  constructor(
    private readonly logger: Logger,
    private readonly config: PlatformPlugin,
    private readonly homebridge: API
  ) {}

  get tvs() {
    const config = this.config as TVPlugin;
    return config.tvs ? config.tvs : config.tv ? [config.tv] : [];
  }

  accessories(callback: (accessories: AccessoryPlugin[]) => void) {
    const accessories = this.tvs.map(
      config =>
        new MiTVAccessory(
          this.logger,
          config as AccessoryConfig,
          this.homebridge
        )
    );
    callback(accessories);
  }
}

export default registerPlatform;
