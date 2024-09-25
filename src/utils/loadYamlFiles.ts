import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import glob from 'glob';
import { ensureError } from '../errors/ensureError';

export function loadAndCombineYamlFiles(
  directory: string
): Record<string, any> {
  try {
    return glob.sync(path.join(directory, '*.yaml')).reduce((acc, file) => {
      const content = yaml.load(fs.readFileSync(file, 'utf8')) as Record<
        string,
        any
      >;
      return { ...acc, ...content.paths };
    }, {});
  } catch (err) {
    throw ensureError('YAML파일 파싱 중 에러 발생');
  }
}
