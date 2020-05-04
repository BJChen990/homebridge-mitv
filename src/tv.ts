import fetch from 'node-fetch';
import buildUrl from 'build-url';
import { md5 } from './utils/crypto_utils';

export const enum Keys {
  POWER = 'power',
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
  HOME = 'home',
  ENTER = 'enter',
  BACK = 'back',
  MENU = 'menu',
  VOLUME_UP = 'volumeup',
  VOLUME_DOWN = 'volumedown',
}

function wait(timeout: number) {
  return new Promise(resolve => setTimeout(() => resolve(), timeout));
}

export class TV {
  constructor(private readonly ip: string) {}

  async powerOff() {
    await this.pressKey(Keys.POWER);
    await wait(300);
    await this.pressKey(Keys.POWER);
  }

  async setVolume(volume: number) {
    const nowString = `${Date.now()}`;
    const { ethmac } = await this.systemInfo();
    const timeSlice = nowString.slice(nowString.length - 5);
    const sign = md5(
      Buffer.from(`mitvsignsalt${volume}${ethmac}${timeSlice}`)
    ).toString('hex');
    const url = this.buildUrl({
      path: 'general',
      queryParams: {
        action: 'setVolum',
        volum: `${volume}`,
        ts: nowString,
        sign,
      },
    });
    console.log(url);
    return this.request(url);
  }

  async systemInfo() {
    const url = this.buildUrl({
      path: 'controller',
      queryParams: { action: 'getsysteminfo' },
    });
    return this.request<{ ethmac: string }>(url);
  }

  async getVolume() {
    const url = this.buildUrl({
      path: 'general',
      queryParams: { action: 'getVolum' },
    });

    const resultStr = await this.request<string>(url);
    return JSON.parse(resultStr) as {
      stream: string;
      maxVolum: number;
      volum: number;
    };
  }

  async changeSource(source: 'hdmi1' | 'hdmi2') {
    const url = this.buildUrl({
      path: 'controller',
      queryParams: {
        action: 'changesource',
        source,
      },
    });
    console.log(await this.request<{ devicename: string }>(url));
  }

  async status() {
    const url = this.buildUrl({
      path: 'request',
      queryParams: { action: 'isalive' },
    });
    return await this.request<{ devicename: string }>(url);
  }

  async pressKey(key: Keys) {
    const url = this.buildUrl({
      path: 'controller',
      queryParams: {
        action: 'keyevent',
        keycode: key,
      },
    });

    return this.request<any>(url);
  }

  private buildUrl(options: buildUrl.BuildUrlOptions) {
    return buildUrl(`http://${this.ip}:6095`, options);
  }

  private async request<T>(url: string) {
    const response = await fetch(url);
    const result = (await response.json()) as MiTVResponse<T>;
    if (
      result.msg !== 'success' &&
      result.request_result !== 200 &&
      result.response_result !== 200
    ) {
      throw new Error(`request fail: message: ${JSON.stringify(result)}`);
    }
    return result.data;
  }
}

interface MiTVResponse<T> {
  request_result?: number;
  response_result?: number;
  status?: number;
  msg: string;
  data: T;
}
