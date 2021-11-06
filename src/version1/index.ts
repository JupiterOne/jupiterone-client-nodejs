import config, { getEnvironmentVariable } from '@j1_config/index';
import { JupiterOneClient } from '..';

const authenticateUser = () => ({});

const getAccessToken = () => {
  const accessTokenEnvVar = getEnvironmentVariable('J1_API_TOKEN');
  if (accessTokenEnvVar) return accessTokenEnvVar;

  return authenticateUser();
};

const setHeaders = (details: any) => {
  return {
    Authorization: `Bearer ${details.token}`,
    'LifeOmic-Account': details.account,
    'Content-Type': 'application/json',
  };
};

// TODO: types
const init = async (options: any): Promise<JupiterOneClient> => {
  const token = await getAccessToken();
  const headers = setHeaders({ account: options.account, token });

  const uri = options.useRulesEndpoint
    ? config.rulesEndpoint
    : config.queryEndpoint;

  const link = ApolloLink.from([
    new RetryLink({
      delay: {
        initial: 2000,
        max: 5000,
        jitter: true,
      },
    }),
    new BatchHttpLink({ uri, headers: this.headers, fetch }),
  ]);
  const cache = new InMemoryCache();
  this.graphClient = new ApolloClient({ link, cache });

  return this;
};

const j1 = async () => {
  console.log('jupiter one');

  await init();
};

export default j1;
