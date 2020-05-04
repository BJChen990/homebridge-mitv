import registerPlatform from './platform';
import { API } from 'homebridge';

export default (homebridge: API) => {
  registerPlatform(homebridge);
};
