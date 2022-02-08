import { JupiterOneClient } from '@jupiterone/jupiterone-client-nodejs';

export const authenticate = async (): Promise<JupiterOneClient> => {
  console.log('Authenticating...');

  const input = {
    accessToken: process.env.J1_ACCESS_TOKEN,
    account: process.env.J1_ACCOUNT,
    dev: process.env.J1_DEV_ENABLED === 'true',
  };

  const j1 = new JupiterOneClient(input);

  await j1.init();

  console.log('Successfully authenticated...');

  return j1;
};
