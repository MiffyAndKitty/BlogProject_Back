import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import glob from 'glob';

export function loadAndCombineYamlFiles(
  directory: string
): Record<string, any> {
  return glob.sync(path.join(directory, '*.yaml')).reduce((acc, file) => {
    const content = yaml.load(fs.readFileSync(file, 'utf8')) as Record<
      string,
      any
    >;
    return { ...acc, ...content.paths };
  }, {});
}
