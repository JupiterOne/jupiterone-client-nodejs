const { ApolloLink, Observable } = require("apollo-link");

export default class MockLink extends ApolloLink {
  constructor(execute) {
    super();
    this.execute = execute;
  }

  request(operation) {
    return new Observable(observer => {
      this.execute(observer)
        .then(data => {
          if (!observer.closed) {
            observer.next(data);
            observer.complete();
          }
        })
        .catch(error => {
          if (!observer.closed) {
            observer.error(error);
          }
        });
    });
  }
}
