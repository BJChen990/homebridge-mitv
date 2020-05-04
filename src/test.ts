import { TV, Keys } from './tv';

const tv = new TV('192.168.8.171');
tv.getVolume()
  .then(console.log)
  .then(() => process.exit(0))
  .catch(console.error);
