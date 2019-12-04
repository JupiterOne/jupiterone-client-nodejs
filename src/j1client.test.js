const { ApolloError } = require("apollo-client");
const JupiterOneClient = require("./j1client");
const MockLink = require("./util/mockLink");

const FAKE_ACCOUNT = "johndoe";
const FAKE_KEY = "abc123";

const j1qlString = "Find jupiterone_account";
const mockResponse = {
  data: {
    queryV1: {
      data: [],
      __typename: "QueryV1Response"
    }
  }
};

describe("JupiterOneClient", () => {
  let j1Client;

  describe("rate limit throttling", () => {
    let attempts = 0;

    describe("failing 4 times with 401, then succeeding", () => {
      beforeEach(() => {
        attempts = 0;

        const mockLink = new MockLink(async () => {
          attempts++;
          if (attempts <= 4) {
            throw new ApolloError("Authentication failed.", 401);
          } else {
            return mockResponse;
          }
        });

        return new JupiterOneClient({
          account: FAKE_ACCOUNT,
          accessToken: FAKE_KEY
        })
          .init(mockLink)
          .then(client => {
            j1Client = client;
          });
      });

      it("fails", async () => {
        const results = await j1Client.queryV1(j1qlString);
        console.log(results);

        expect(false).toBeTruthy();
      });
    });

    describe("failing 4 times with 429, then succeeding", () => {
      beforeEach(() => {
        attempts = 0;

        const mockLink = new MockLink(async () => {
          attempts++;
          if (attempts <= 4) {
            throw new ApolloError("Too many requests.", 429);
          } else {
            return mockResponse;
          }
        });

        return new JupiterOneClient({
          account: FAKE_ACCOUNT,
          accessToken: FAKE_KEY
        })
          .init(mockLink)
          .then(client => {
            j1Client = client;
          });
      });

      it("fails", async () => {
        const results = await j1Client.queryV1(j1qlString);
        console.log(results);

        expect(false).toBeTruthy();
      });
    });

    describe("failing 5 times with 429, then succeeding", () => {
      beforeEach(() => {
        attempts = 0;

        const mockLink = new MockLink(async () => {
          attempts++;
          if (attempts <= 5) {
            throw new ApolloError("Too many requests.", 429);
          } else {
            return mockResponse;
          }
        });

        return new JupiterOneClient({
          account: FAKE_ACCOUNT,
          accessToken: FAKE_KEY
        })
          .init(mockLink)
          .then(client => {
            j1Client = client;
          });
      });

      it("fails", async () => {
        const results = await j1Client.queryV1(j1qlString);
        console.log(results);

        expect(false).toBeTruthy();
      });
    });
  });
});
