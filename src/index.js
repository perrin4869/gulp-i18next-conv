import PluginError from 'plugin-error';
import through from 'through2';
import { sep, extname } from 'path';
import vinylToString from 'vinyl-contents-tostring';
import asCallback from 'standard-as-callback';
import {
  gettextToI18next,
  i18nextToPo,
  i18nextToPot,
  i18nextToMo,
} from 'i18next-conv';

const PLUGIN_NAME = 'gulp-i18next-conv';
const defDetermineLocale = (filename) => filename.split(sep)[0];

function getConverter(file, gettextFormat) {
  switch (extname(file.path)) { // file.extname doesn't work in older vinyl used by gulp 3
    case '.po':
    case '.pot':
    case '.mo':
      return [gettextToI18next, '.json'];
    case '.json':
      switch (gettextFormat) {
        case 'po':
          return [i18nextToPo, '.po'];
        case 'pot':
          return [i18nextToPot, '.pot'];
        case 'mo':
          return [i18nextToMo, '.mo'];
        default:
          throw new Error('Cannot determine which which file to convert to.');
      }
    default:
      throw new Error('Cannot determine which which file to convert to.');
  }
}

const getContents = (file, data) => (file.isBuffer() // eslint-disable-line no-nested-ternary
  ? Buffer.from(data)
  : file.isStream()
    ? through().end(data)
    : throw new Error('Invalid file'));

export default ({
  determineLocale = defDetermineLocale,
  gettextFormat = 'po',
  ...options
} = {}) => through.obj(function (file, enc, cb) {
  if (file.isNull()) {
    this.push(file);
    return cb();
  }

  let converter;
  let ext;

  try {
    [converter, ext] = getConverter(file, gettextFormat);
  } catch (err) {
    return cb(new PluginError(PLUGIN_NAME, err.message));
  }

  return asCallback(vinylToString(file, enc)
    .then((contents) => {
      let domain;

      try {
        domain = determineLocale(file.relative, contents);
      } catch (e) {
        return Promise.reject(new Error('determineLocale failed'));
      }

      return converter(domain, contents, options);
    })
    .then((data) => Object.assign(file, {
      extname: ext,
      contents: getContents(file, data),
    }))
    .then(() => { this.push(file); })
    .catch((err) => Promise.reject(new PluginError(PLUGIN_NAME, err.message, { showStack: true }))),
  cb);
});
export { defDetermineLocale as determineLocale };
