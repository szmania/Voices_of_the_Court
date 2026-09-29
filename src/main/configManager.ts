import { Config } from '../shared/Config';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

let config: Config;

export async function getConfig(): Promise<Config> {
    if (config) {
        return config;
    }

    const userDataPath = path.join(app.getPath('userData'), 'votc_data');
    const configPath = path.join(userDataPath, 'configs', 'config.json');

    if (!fs.existsSync(configPath)) {
        const defaultConfigPath = path.join(userDataPath, 'configs', 'default_config.json');
        const defaultConfig = await JSON.parse(fs.readFileSync(defaultConfigPath).toString());
        await fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, '\t'));
    }

    config = new Config(configPath);
    return config;
}
